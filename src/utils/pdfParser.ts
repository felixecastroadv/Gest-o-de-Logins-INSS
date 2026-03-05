import * as pdfjsLib from 'pdfjs-dist';

// Use CDN with dynamic version to ensure match with installed library
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  images: string[]; // Base64 strings for pages that need OCR/Vision
  isScanned: boolean;
}

export async function extractTextFromPDF(file: File): Promise<PDFContent> {
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    throw new Error("Biblioteca PDF.js não carregada corretamente. Tente recarregar a página.");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error("Tempo limite de leitura do PDF excedido (30s).")), 30000)
    );

    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    
    let fullText = '';
    const images: string[] = [];
    let totalTextLength = 0;

    // Limit image rendering to first 5 pages to avoid payload explosion
    // If it's a huge document, we assume it's digital or user will split it.
    const maxPagesToRender = 5; 

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      
      // 1. Extract Text
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      if (pageText.trim()) {
        fullText += `--- Página ${i} ---\n${pageText}\n\n`;
        totalTextLength += pageText.length;
      }

      // 2. Heuristic: If text is very short (< 50 chars), assume it's scanned/handwritten
      // OR if the user explicitly wants to read handwritten notes (we can't know intent here, so we rely on density)
      // For now, if density is low, we render.
      const isLowDensity = pageText.length < 100;

      if (isLowDensity && i <= maxPagesToRender) {
        try {
          const viewport = page.getViewport({ scale: 1.5 }); // 1.5 scale for decent OCR quality
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ 
              canvasContext: context, 
              viewport: viewport 
            } as any).promise;
            
            // Convert to JPEG (Base64) - remove prefix for API
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            images.push(base64);
          }
        } catch (renderError) {
          console.warn(`Erro ao renderizar página ${i} como imagem:`, renderError);
        }
      }
    }

    const isScanned = images.length > 0;

    if (!fullText.trim() && images.length === 0) {
       // If no text and rendering failed
       return { 
         text: "ERRO: O PDF parece vazio e não foi possível converter para imagem.", 
         images: [], 
         isScanned: false 
       };
    }

    return { text: fullText, images, isScanned };

  } catch (error: any) {
    console.error("PDF Extraction Error:", error);
    if (error.name === 'PasswordException') {
      throw new Error("O arquivo PDF está protegido por senha.");
    }
    throw new Error(`Falha técnica ao extrair texto do PDF: ${error.message}`);
  }
}
