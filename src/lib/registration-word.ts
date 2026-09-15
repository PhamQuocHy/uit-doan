import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/** Export the same selected dossier as a native, editable Word document. */
export async function registrationWordBlob(html: string): Promise<Blob> {
  const source = new DOMParser().parseFromString(html, "text/html");
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const blocks: (Paragraph | Table)[] = [];

  function runs(node: Node, bold = false, italics = false): TextRun[] {
    if (node.nodeType === 3) return [new TextRun({ text: node.textContent || "", bold, italics })];
    if (!(node instanceof Element)) return [];
    if (node.tagName === "BR") return [new TextRun({ break: 1 })];
    if (node.classList.contains("checkbox")) return [new TextRun("☐ ")];
    if (node.classList.contains("field") && !node.textContent?.trim()) return [new TextRun("…………")];
    return Array.from(node.childNodes).flatMap(child => runs(child,
      bold || ["B", "STRONG", "TH"].includes(node.tagName), italics || ["I", "EM"].includes(node.tagName)));
  }

  function paragraph(element: Element, center = false) {
    const heading = element.tagName === "H1" || element.tagName === "H2";
    return new Paragraph({
      children: runs(element, heading, element.classList.contains("subtitle")),
      alignment: center || element.tagName === "H1" || element.classList.contains("subtitle") ? AlignmentType.CENTER
        : element.classList.contains("date") ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: heading ? 100 : 0, after: 50 },
      keepNext: heading,
    });
  }

  function table(element: Element): Table {
    const borderless = element.classList.contains("signers");
    const widths = Array.from(element.querySelectorAll(":scope > colgroup > col"))
      .map(col => parseFloat((col as HTMLElement).style.width));
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      ...(borderless ? { borders: noBorders } : {}),
      rows: Array.from(element.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr")).map(row =>
        new TableRow({ tableHeader: row.parentElement?.tagName === "THEAD", cantSplit: true,
          children: Array.from(row.children).map((cell, index) => new TableCell({
            width: { size: widths[index] || 100 / row.children.length, type: WidthType.PERCENTAGE },
            ...(borderless ? { borders: noBorders } : {}),
            children: [paragraph(cell, borderless || cell.tagName === "TH")],
          })),
        })),
    });
  }

  function columns(element: Element, widths: number[]): Table {
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
      rows: [new TableRow({ children: Array.from(element.children).map((cell, index) => new TableCell({
        borders: noBorders, width: { size: widths[index] || 100 / element.children.length, type: WidthType.PERCENTAGE },
        children: cell.classList.contains("motto") ? [paragraph(cell, true)]
          : cell.classList.contains("line") ? [paragraph(cell)]
          : Array.from(cell.children).flatMap(convert),
      })) })],
    });
  }

  function convert(element: Element): (Paragraph | Table)[] {
    if (element.tagName === "TABLE") return [table(element)];
    if (element.classList.contains("columns") || element.classList.contains("identity")) {
      return [columns(element, element.classList.contains("identity") ? [37, 22, 41]
        : element.classList.contains("personal") ? [43, 33, 24] : [62, 38])];
    }
    if (element.classList.contains("signature") || element.classList.contains("round-two")) {
      return [
        ...(element.classList.contains("round-two") ? [new Paragraph({ pageBreakBefore: true, children: [] })] : []),
        ...Array.from(element.children).flatMap(convert),
      ];
    }
    return [paragraph(element)];
  }

  for (const element of Array.from(source.querySelector(".sheet")!.children)) {
    if (element.classList.contains("header")) blocks.push(columns(element, [45, 55]));
    else if (element.classList.contains("profile")) {
      const photo = element.querySelector("img");
      let portrait = new Paragraph("");
      if (photo) {
        const response = await fetch(photo.getAttribute("src")!);
        if (!response.ok) throw new Error("Không tải được ảnh để đưa vào Word");
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không chuyển được ảnh")), "image/png"));
        const fit = Math.min(128 / canvas.width, 170 / canvas.height);
        portrait = new Paragraph({ children: [new ImageRun({ type: "png", data: new Uint8Array(await image.arrayBuffer()),
          transformation: { width: Math.round(canvas.width * fit), height: Math.round(canvas.height * fit) } })] });
      }
      blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
        rows: [new TableRow({ cantSplit: true, children: [
          new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, children: [portrait] }),
          new TableCell({ width: { size: 76, type: WidthType.PERCENTAGE }, borders: noBorders,
            children: Array.from(element.children[1].children).flatMap(convert) }),
        ] })],
      }));
    } else blocks.push(...convert(element));
  }
  return Packer.toBlob(new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 },
      margin: { top: 1361, bottom: 1134, left: 1814, right: 1134 } } }, children: blocks }],
  }));
}
