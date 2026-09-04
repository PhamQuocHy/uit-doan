import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const root = process.cwd();
const sourceDir = path.join(root, "data", "legal-docs");
const outputDirs = [
  sourceDir,
  path.join(root, "public", "documents", "nvqs"),
];
const fontCandidates = [
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\segoeui.ttf",
];
const fontPath = fontCandidates.find((candidate) => fs.existsSync(candidate));

if (!fontPath) {
  throw new Error("Không tìm thấy font Unicode trên Windows để tạo PDF tiếng Việt.");
}
const unicodeFontPath = fontPath;
const officialScanPages: Record<string, string[]> = {
  "68-2025-TT-BQP.pdf": [
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-0-17519017364681969452036.jpg",
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-1-1751901762348438364745.jpg",
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-2-1751901778339434017621.jpg",
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-3-1751901795805197352288.jpg",
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-4-1751901813252843045730.jpg",
    "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/7/7/tt682025bqp-hinh-anh-5-17519018282621856397045.jpg",
  ],
};

function markdownToText(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```\s*/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\r\n/g, "\n")
    .trim();
}

function createPdf(sourceFile: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      bufferPages: true,
    });
    const stream = fs.createWriteStream(outputFile);
    stream.on("finish", resolve);
    stream.on("error", reject);
    document.pipe(stream);
    document.font(unicodeFontPath).fontSize(11).fillColor("#17202a");
    document.text(markdownToText(fs.readFileSync(sourceFile, "utf8")), {
      width: 487,
      align: "left",
      lineGap: 4,
    });
    const pageCount = document.bufferedPageRange().count;
    for (let index = 0; index < pageCount; index += 1) {
      document.switchToPage(index);
      document.fontSize(8).fillColor("#667085").text(
        `YMSA - Kho van ban NVQS | Trang ${index + 1}/${pageCount}`,
        54,
        770,
        { align: "center", width: 487 },
      );
    }
    document.end();
  });
}

async function createOfficialScanPdf(pageUrls: string[], outputFile: string) {
  const pages = await Promise.all(
    pageUrls.map(async (url) => Buffer.from(await (await fetch(url)).arrayBuffer())),
  );
  const document = new PDFDocument({ size: "A4", margin: 0 });
  const stream = fs.createWriteStream(outputFile);
  document.pipe(stream);
  pages.forEach((page, index) => {
    if (index > 0) document.addPage({ size: "A4", margin: 0 });
    document.image(page, 0, 0, { fit: [595.28, 841.89], align: "center", valign: "center" });
  });
  document.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function main() {
  const markdownFiles = fs
    .readdirSync(sourceDir)
    .filter((fileName) => fileName.endsWith(".md"));
  for (const markdownFile of markdownFiles) {
    const pdfFile = markdownFile.replace(/\.md$/i, ".pdf");
    for (const outputDir of outputDirs) {
      await createPdf(
        path.join(sourceDir, markdownFile),
        path.join(outputDir, pdfFile),
      );
      const scanPages = officialScanPages[pdfFile];
      if (scanPages) {
        await createOfficialScanPdf(scanPages, path.join(outputDir, pdfFile));
      }
    }
    console.log(`Created ${pdfFile}`);
  }
}

void main();
