import * as pdfjsLib from 'pdfjs-dist';

// Use cdnjs for better reliability and speed
const PDFJS_VERSION = '3.11.174'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      if (pageText.trim()) {
        fullText += `--- Página ${i} ---\n${pageText}\n\n`;
      }
    }

    if (!fullText.trim()) {
      return "AVISO: Este PDF parece ser uma imagem digitalizada (scanned) sem camada de texto. O conteúdo não pôde ser lido diretamente.";
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF Extraction Error:", error);
    if (error.name === 'PasswordException') {
      throw new Error("O arquivo PDF está protegido por senha.");
    }
    throw new Error(`Falha técnica ao extrair texto do PDF: ${error.message}`);
  }
}
