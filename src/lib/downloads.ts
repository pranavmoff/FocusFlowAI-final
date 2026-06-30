/** Client-only download helpers. PNG via html2canvas, PDF via jsPDF. */
import { toast } from "sonner";

function slugify(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "FocusFlow";
}

function monthYear(d = new Date()) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" }).replace(" ", "_");
}

export function reportFilename(period: "weekly" | "monthly" | "yearly", suffix = "pdf") {
  const label = period === "yearly" ? "Annual_Review" : period === "monthly" ? "Monthly_Report" : "Weekly_Report";
  return `FocusFlow_${label}_${monthYear()}.${suffix}`;
}

export function cardFilename(kind: string, label: string, ext = "png") {
  return `FocusFlow_${kind}_${slugify(label)}.${ext}`;
}

export async function downloadElementAsPng(el: HTMLElement, filename: string, bg = "#0f1729") {
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(el, { backgroundColor: bg, scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`Saved ${filename}`);
  } catch (e: any) {
    console.error(e);
    toast.error("Couldn't save image. Try again.");
  }
}

export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, { backgroundColor: "#0f1729", scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.height / canvas.width;
    const imgW = pageW - 40;
    const imgH = imgW * ratio;
    if (imgH <= pageH - 40) {
      pdf.addImage(imgData, "PNG", 20, 20, imgW, imgH);
    } else {
      // multi-page slice
      const pageContentH = pageH - 40;
      const scale = imgW / canvas.width;
      let y = 0;
      while (y < canvas.height) {
        const sliceH = Math.min(canvas.height - y, pageContentH / scale);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL("image/png");
        pdf.addImage(sliceData, "PNG", 20, 20, imgW, sliceH * scale);
        y += sliceH;
        if (y < canvas.height) pdf.addPage();
      }
    }
    pdf.save(filename);
    toast.success(`Saved ${filename}`);
  } catch (e: any) {
    console.error(e);
    toast.error("Couldn't generate PDF. Try again.");
  }
}
