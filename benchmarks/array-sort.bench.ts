import { faker } from "@faker-js/faker";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";

faker.seed(42);

const array = Array.from({ length: 100000 }, () => faker.string.sample());

const collator = new Intl.Collator();

summary(() => {
	barplot(() => {
		bench("const Intl.Collator", () => {
			do_not_optimize(array.toSorted((left, right) => collator.compare(left, right)));
		});
		bench("localeCompare", () => {
			do_not_optimize(array.toSorted((left, right) => left.localeCompare(right)));
		});
	});
});

await run({});
