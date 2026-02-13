const { loadAllExperiments } = require("./experiment-log");

function formatPercent(value) {
  return (value * 100).toFixed(1) + "%";
}

function padRight(str, len) {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function padLeft(str, len) {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function run() {
  const experiments = loadAllExperiments();

  if (experiments.length === 0) {
    console.log("No experiments found in results/experiments/");
    return;
  }

  // Collect all provider names across all experiments
  const allProviders = [
    ...new Set(experiments.flatMap((e) => Object.keys(e.summary))),
  ];

  // Define columns
  const columns = [
    { header: "ID", width: 22, align: "left" },
    { header: "Date", width: 10, align: "left" },
    { header: "Tag", width: 20, align: "left" },
    { header: "Images", width: 6, align: "right" },
    { header: "Prompt", width: 6, align: "left" },
    { header: "Preprocess", width: 12, align: "left" },
    ...allProviders.map((p) => ({
      header: p.split(" ")[0] + " Avg%",
      width: 14,
      align: "right",
    })),
  ];

  // Print header
  const headerLine = columns
    .map((c) =>
      c.align === "right"
        ? padLeft(c.header, c.width)
        : padRight(c.header, c.width),
    )
    .join(" | ");
  const separator = columns.map((c) => "-".repeat(c.width)).join("-+-");

  console.log(headerLine);
  console.log(separator);

  // Print rows
  for (const exp of experiments) {
    const date = exp.timestamp.slice(0, 10);
    const tag = exp.tag || "-";

    const values = [
      exp.id,
      date,
      tag.length > 20 ? tag.slice(0, 17) + "..." : tag,
      String(exp.imageCount),
      exp.promptVersion,
      exp.preprocessing || "none",
      ...allProviders.map((p) => {
        const s = exp.summary[p];
        return s ? formatPercent(s.avgAccuracy) : "-";
      }),
    ];

    const row = columns
      .map((c, i) =>
        c.align === "right"
          ? padLeft(values[i], c.width)
          : padRight(values[i], c.width),
      )
      .join(" | ");

    console.log(row);
  }

  console.log("");
  console.log(`Total experiments: ${experiments.length}`);
}

run();
