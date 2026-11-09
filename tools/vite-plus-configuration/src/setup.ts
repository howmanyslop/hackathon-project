// oxlint-disable import/no-namespace -- Namespace import required for jest-extended matchers

import * as matchers from "jest-extended";
import { expect } from "vite-plus/test";

expect.extend(matchers);
