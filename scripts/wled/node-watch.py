"""Streams one JSON line per interval describing every Kubernetes node.

Runs on the k3s server and is piped over SSH by wled-cluster-status.ts, so the
laptop pays the SSH connection cost once instead of on every poll. A node is
reachable when it answers a ping, which notices a pulled cable within a second
or two; Kubernetes itself waits about 40 seconds before marking it NotReady.
"""

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

KUBECONFIG = "/etc/rancher/k3s/k3s.yaml"
INTERVAL = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0


def ping(address):
    # Two probes so one dropped packet is not mistaken for an unplugged node.
    result = subprocess.run(
        ["ping", "-c", "2", "-i", "0.2", "-W", "1", address],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def read_nodes():
    output = subprocess.run(
        [
            "sudo",
            "-n",
            "kubectl",
            "--kubeconfig",
            KUBECONFIG,
            "get",
            "nodes",
            "-o",
            "json",
        ],
        capture_output=True,
        timeout=5,
        check=True,
    ).stdout
    items = json.loads(output)["items"]
    addresses = []
    for item in items:
        internal = [
            a["address"]
            for a in item["status"].get("addresses", [])
            if a["type"] == "InternalIP"
        ]
        addresses.append(internal[0] if internal else None)

    with ThreadPoolExecutor(max_workers=max(1, len(items))) as pool:
        reachable = list(
            pool.map(lambda address: address is None or ping(address), addresses)
        )

    nodes = []
    for item, is_reachable in zip(items, reachable):
        conditions = {
            c["type"]: c["status"] for c in item["status"].get("conditions", [])
        }
        nodes.append(
            {
                "name": item["metadata"]["name"],
                "controlPlane": "node-role.kubernetes.io/control-plane"
                in item["metadata"].get("labels", {}),
                "ready": conditions.get("Ready") == "True",
                "reachable": is_reachable,
                "unschedulable": bool(item.get("spec", {}).get("unschedulable", False)),
            }
        )

    return nodes


while True:
    started = time.time()
    try:
        print(json.dumps({"nodes": read_nodes()}), flush=True)
    except Exception as error:  # noqa: BLE001 - report and keep streaming.
        print(json.dumps({"error": str(error)}), flush=True)

    time.sleep(max(0.0, INTERVAL - (time.time() - started)))
