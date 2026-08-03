import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { API_TOKEN, HOST } from "@/utils/constants";
import { format } from "date-fns";

// Inicializa las fuentes
pdfMake.vfs = pdfFonts.vfs;

interface PatientData {
  nombre?: string;
  dni?: string;
  sexo?: string;
  fecha_de_nacimiento?: string;
}

interface ReportData {
  tipo_estudio?: string;
  fecha_de_muestra?: string;
  promedio_rta_img?: string;
}

/**
 * Función auxiliar para parsear el contenido del informe
 */
function parseReportContent(content: string): {
  ki67?: string;
  er?: { percentage: string; intensity: string; interpretation: string };
  pr?: { percentage: string; intensity: string; interpretation: string };
  her2?: { percentage: string; interpretation: string };
  conclusion?: string;
} {
  const parsed: any = {};
  
  if (!content) return parsed;
  
  // Intentar parsear como JSON primero (nuevo formato)
  try {
    const jsonData = JSON.parse(content);
    
    // Si es JSON válido, extraer los datos directamente
    if (jsonData.ki67) {
      parsed.ki67 = jsonData.ki67.includes('%') ? jsonData.ki67 : jsonData.ki67 + '%';
    }
    
    if (jsonData.estrogen && (jsonData.estrogen.percentage || jsonData.estrogen.intensity || jsonData.estrogen.interpretation)) {
      parsed.er = {
        percentage: jsonData.estrogen.percentage ? (jsonData.estrogen.percentage.includes('%') ? jsonData.estrogen.percentage : jsonData.estrogen.percentage + '%') : '',
        intensity: jsonData.estrogen.intensity || '',
        interpretation: jsonData.estrogen.interpretation || ''
      };
    }
    
    if (jsonData.progesterone && (jsonData.progesterone.percentage || jsonData.progesterone.intensity || jsonData.progesterone.interpretation)) {
      parsed.pr = {
        percentage: jsonData.progesterone.percentage ? (jsonData.progesterone.percentage.includes('%') ? jsonData.progesterone.percentage : jsonData.progesterone.percentage + '%') : '',
        intensity: jsonData.progesterone.intensity || '',
        interpretation: jsonData.progesterone.interpretation || ''
      };
    }
    
    if (jsonData.her2 && (jsonData.her2.percentage || jsonData.her2.interpretation)) {
      parsed.her2 = {
        percentage: jsonData.her2.percentage ? (jsonData.her2.percentage.includes('%') ? jsonData.her2.percentage : jsonData.her2.percentage + '%') : '',
        interpretation: jsonData.her2.interpretation || ''
      };
    }
    
    if (jsonData.conclusion) {
      parsed.conclusion = jsonData.conclusion;
    }
    
    return parsed;
  } catch (e) {
    // Si no es JSON, usar el parser de regex antiguo (retrocompatibilidad)
    console.log('Parseando informe en formato string (legacy)');
  }
  
  // Parsear Ki67 - Más flexible con diferentes formatos
  const ki67Match = content.match(/(?:Resultado de Ki67|Ki-?67|ki67)[:\s]+([0-9.]+%?)/i) ||
                    content.match(/ki-?67[:\s]*([0-9.]+%?)/i);
  if (ki67Match) {
    parsed.ki67 = ki67Match[1].includes('%') ? ki67Match[1] : ki67Match[1] + '%';
  }
  
  // Parsear ER (Estrogen) - Más flexible
  const erPercentageMatch = content.match(/(?:Células positivas|Positivas|Positive cells?)?\s*\(?(?:Estrógenos?|Estrogen|ER)\)?[:\s]+([0-9.]+%?)/i);
  const erIntensityMatch = content.match(/(?:Intensidad de tinción|Intensidad|Intensity)\s*\(?(?:Estrógenos?|Estrogen|ER)\)?[:\s]+(bajo|moderado|fuerte|débil|weak|moderate|strong|low|high)/i);
  const erInterpretationMatch = content.match(/(?:Interpretación|Interpretation)\s*\(?(?:Estrógenos?|Estrogen|ER)\)?[:\s]+([^;]+)/i);
  
  if (erPercentageMatch || erIntensityMatch || erInterpretationMatch) {
    parsed.er = {
      percentage: erPercentageMatch ? (erPercentageMatch[1].includes('%') ? erPercentageMatch[1] : erPercentageMatch[1] + '%') : '',
      intensity: erIntensityMatch ? erIntensityMatch[1] : '',
      interpretation: erInterpretationMatch ? erInterpretationMatch[1].trim() : ''
    };
  }
  
  // Parsear PR (Progesterone) - Más flexible
  const prPercentageMatch = content.match(/(?:Células positivas|Positivas|Positive cells?)?\s*\(?(?:Progesterona?|Progesterone|PR)\)?[:\s]+([0-9.]+%?)/i);
  const prIntensityMatch = content.match(/(?:Intensidad de tinción|Intensidad|Intensity)\s*\(?(?:Progesterona?|Progesterone|PR)\)?[:\s]+(bajo|moderado|fuerte|débil|weak|moderate|strong|low|high)/i);
  const prInterpretationMatch = content.match(/(?:Interpretación|Interpretation)\s*\(?(?:Progesterona?|Progesterone|PR)\)?[:\s]+([^;]+)/i);
  
  if (prPercentageMatch || prIntensityMatch || prInterpretationMatch) {
    parsed.pr = {
      percentage: prPercentageMatch ? (prPercentageMatch[1].includes('%') ? prPercentageMatch[1] : prPercentageMatch[1] + '%') : '',
      intensity: prIntensityMatch ? prIntensityMatch[1] : '',
      interpretation: prInterpretationMatch ? prInterpretationMatch[1].trim() : ''
    };
  }
  
  // Parsear HER2 - Más flexible
  const her2PercentageMatch = content.match(/(?:Resultado de |Positive cells?)?\s*(?:HER-?2|her-?2)[:\s]+([0-9.]+%?)/i);
  const her2InterpretationMatch = content.match(/(?:Interpretación|Interpretation)\s*\(?(?:HER-?2|her-?2)\)?[:\s]+([^;]+)/i);
  
  if (her2PercentageMatch || her2InterpretationMatch) {
    parsed.her2 = {
      percentage: her2PercentageMatch ? (her2PercentageMatch[1].includes('%') ? her2PercentageMatch[1] : her2PercentageMatch[1] + '%') : '',
      interpretation: her2InterpretationMatch ? her2InterpretationMatch[1].trim() : ''
    };
  }
  
  // Parsear conclusión
  const conclusionMatch = content.match(/(?:Conclusión|Conclusion)[:\s]+(.+)$/i);
  if (conclusionMatch) parsed.conclusion = conclusionMatch[1].trim();
  
  return parsed;
}

/**
 * Función auxiliar para determinar el estado del marcador
 */
function getMarkerStatus(percentage: string, marker: 'ER' | 'PR' | 'HER2'): string {
  const value = parseFloat(percentage);
  if (isNaN(value)) return 'Indeterminate';
  
  if (marker === 'ER' || marker === 'PR') {
    if (value >= 10) return 'Positive';
    if (value >= 1 && value < 10) return 'Low Positive';
    return 'Negative';
  }
  
  return value > 0 ? 'Positive' : 'Negative';
}

/**
 * Función auxiliar para interpretar Ki67
 */
function interpretKi67(percentage: string): string {
  const value = parseFloat(percentage);
  if (isNaN(value)) return 'Not available';
  
  if (value < 15) return 'Low proliferation';
  if (value <= 30) return 'Intermediate proliferation';
  return 'High proliferation';
}

/**
 * Generates a professional Breast Biomarker Report PDF
 */
export default async function generarPDF(pacienteId: string = "idPaciente", informeId: string = "idInforme", authToken?: string): Promise<void> {
  
  if (!authToken) {
    console.error("Error: No authentication token provided for PDF generation");
    throw new Error("Authentication required to generate the PDF");
  }
  
  let patientData: PatientData = {};
  let reportData: ReportData = {};
  
  // Obtener datos del paciente
  try {
    const res = await fetch(`${HOST}paciente/${pacienteId}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (res.ok) {
      patientData = await res.json();
    }
  } catch (error) {
    console.error("Error fetching patient data:", error);
  }

  try {
    const res = await fetch(`${HOST}informe/${informeId}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (res.ok) {
      reportData = await res.json();
    }
  } catch (error) {
    console.error("Error fetching report:", error);
  }

  // Parse report content
  console.log('DEBUG - promedio_rta_img:', reportData.promedio_rta_img);
  const parsedReport = parseReportContent(reportData.promedio_rta_img || '');
  console.log('DEBUG - parsedReport:', parsedReport);
  
  // Formatear fecha
  let formattedDate = 'N/A';
  if (reportData.fecha_de_muestra) {
    try {
      const date = new Date(reportData.fecha_de_muestra);
      formattedDate = format(date, 'dd/MM/yyyy');
    } catch (err) {
      console.warn("Error formatting date:", err);
    }
  }

  // Formatear fecha de nacimiento
  let formattedBirthDate = 'N/A';
  if (patientData.fecha_de_nacimiento) {
    try {
      const date = new Date(patientData.fecha_de_nacimiento);
      formattedBirthDate = format(date, 'dd/MM/yyyy');
    } catch (err) {
      console.warn("Error formatting birth date:", err);
    }
  }

  // Construir contenido del PDF
  const content: Content[] = [
    // Header
    { text: 'Breast Biomarker Report', style: 'title', alignment: 'center', margin: [0, 0, 0, 5] },
    
    // AI Models Disclaimer
    { 
      text: 'Analysis performed with OncoView Breast Panel V.1.0.0 (Cellpose v.2.0 for cell segmentation and CNN/PyTorch convolutional neural networks for biomarker classification)',
      style: 'subsectionTitle',
      alignment: 'center',
      margin: [20, 0, 20, 15],
      fontSize: 8,
      color: '#64748b'
    },
    
    // Patient Information Section
    { text: 'Patient Information', style: 'sectionHeader', margin: [0, 10, 0, 10] },
    {
      table: {
        widths: ['30%', '70%'],
        body: [
          [{ text: 'Patient ID:', style: 'fieldLabel' }, { text: patientData.dni || 'N/A', style: 'fieldValue' }],
          [{ text: 'Patient Name:', style: 'fieldLabel' }, { text: patientData.nombre || 'N/A', style: 'fieldValue' }],
          [{ text: 'Sex:', style: 'fieldLabel' }, { text: patientData.sexo === 'M' ? 'Male' : patientData.sexo === 'F' ? 'Female' : 'N/A', style: 'fieldValue' }],
          [{ text: 'Date of Birth:', style: 'fieldLabel' }, { text: formattedBirthDate, style: 'fieldValue' }],
          [{ text: 'Report Date:', style: 'fieldLabel' }, { text: formattedDate, style: 'fieldValue' }],
          [{ text: 'Study Type:', style: 'fieldLabel' }, { text: reportData.tipo_estudio || 'Core biopsy', style: 'fieldValue' }],
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 15]
    },

    // Separator
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 10, 0, 10] },
  ];

  // Estrogen Receptor (ER)
  if (parsedReport.er) {
    const erStatus = getMarkerStatus(parsedReport.er.percentage, 'ER');
    const isLowPositive = erStatus === 'Low Positive';
    
    content.push(
      { text: 'Estrogen Receptor (ER)', style: 'markerTitle', margin: [0, 10, 0, 8] },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: 'Status:', style: 'fieldLabel' }, { text: erStatus === 'Positive' ? 'Positive' : erStatus === 'Low Positive' ? 'Low Positive' : erStatus === 'Negative' ? 'Negative' : 'Indeterminate', style: 'fieldValue', bold: true }],
            [{ text: '% of cells with nuclear positivity:', style: 'fieldLabel' }, { text: parsedReport.er.percentage || 'N/A', style: 'fieldValue' }],
            [{ text: 'Average intensity:', style: 'fieldLabel' }, { text: parsedReport.er.intensity || 'N/A', style: 'fieldValue' }],
          ]
        },
        layout: 'noBorders',
        margin: [10, 0, 0, 5]
      }
    );
    
    if (isLowPositive) {
      content.push({
        text: 'Comment: This sample has low (1–10%) ER expression by IHC. There are limited data on the overall benefit of endocrine therapies for patients with low ER expression, but current evidence suggests possible benefit, so patients are considered eligible for endocrine treatment.',
        style: 'comment',
        margin: [10, 5, 0, 0]
      });
    }
  }

  // Progesterone Receptor (PR)
  if (parsedReport.pr) {
    const prStatus = getMarkerStatus(parsedReport.pr.percentage, 'PR');
    
    content.push(
      { text: 'Progesterone Receptor (PR / PgR)', style: 'markerTitle', margin: [0, 15, 0, 8] },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: 'Status:', style: 'fieldLabel' }, { text: prStatus === 'Positive' ? 'Positive' : prStatus === 'Low Positive' ? 'Low Positive' : prStatus === 'Negative' ? 'Negative' : 'Indeterminate', style: 'fieldValue', bold: true }],
            [{ text: '% of cells with nuclear positivity:', style: 'fieldLabel' }, { text: parsedReport.pr.percentage || 'N/A', style: 'fieldValue' }],
            [{ text: 'Average intensity:', style: 'fieldLabel' }, { text: parsedReport.pr.intensity || 'N/A', style: 'fieldValue' }],
          ]
        },
        layout: 'noBorders',
        margin: [10, 0, 0, 5]
      }
    );
  }

  // HER2
  if (parsedReport.her2) {
    content.push(
      { text: 'HER2', style: 'markerTitle', margin: [0, 15, 0, 8] },
      { text: 'By Immunohistochemistry (IHC)', style: 'subsectionTitle', margin: [10, 0, 0, 5] },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: 'Score:', style: 'fieldLabel' }, { text: parsedReport.her2.interpretation || 'N/A', style: 'fieldValue', bold: true }],
            [{ text: '% of tumor cells with membrane staining:', style: 'fieldLabel' }, { text: parsedReport.her2.percentage || 'N/A', style: 'fieldValue' }],
          ]
        },
        layout: 'noBorders',
        margin: [20, 0, 0, 5]
      }
    );
  }

  // Ki-67 Proliferation Index
  if (parsedReport.ki67) {
    const ki67Interpretation = interpretKi67(parsedReport.ki67);
    const ki67InterpretationEN = ki67Interpretation === 'Low proliferation' ? 'Low proliferation' : 
                                   ki67Interpretation === 'Intermediate proliferation' ? 'Intermediate proliferation' : 
                                   ki67Interpretation === 'High proliferation' ? 'High proliferation' : 'Not available';
    
    content.push(
      { text: 'Ki-67 Proliferation Index', style: 'markerTitle', margin: [0, 15, 0, 8] },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: '% of cells with nuclear positivity:', style: 'fieldLabel' }, { text: parsedReport.ki67 || 'N/A', style: 'fieldValue', bold: true }],
            [{ text: 'Primary antibody clone:', style: 'fieldLabel' }, { text: 'MIB-1', style: 'fieldValue' }],
          ]
        },
        layout: 'noBorders',
        margin: [10, 0, 0, 5]
      }
    );
  }

  // Additional Notes
  content.push(
    { text: 'Additional Notes', style: 'markerTitle', margin: [0, 15, 0, 8] },
    {
      ul: [
        'Image analysis used: Yes',
        'Biomarkers analyzed by image analysis: ER / PR / HER2 / Ki-67',
        'Quality control: Appropriate internal and external controls.',
      ],
      margin: [10, 0, 0, 10],
      style: 'fieldValue'
    }
  );

  // Summary Table
  if (parsedReport.er || parsedReport.pr || parsedReport.her2 || parsedReport.ki67) {
    const tableBody: any[] = [
      [
        { text: 'Marker', style: 'tableHeader' },
        { text: 'Result', style: 'tableHeader' },
        { text: '% Positive', style: 'tableHeader' },
        { text: 'Intensity', style: 'tableHeader' }
      ]
    ];

    if (parsedReport.er) {
      tableBody.push([
        { text: 'ER', style: 'tableCell' },
        { text: getMarkerStatus(parsedReport.er.percentage, 'ER') === 'Positive' ? 'Positive' : getMarkerStatus(parsedReport.er.percentage, 'ER') === 'Low Positive' ? 'Low Positive' : getMarkerStatus(parsedReport.er.percentage, 'ER') === 'Negative' ? 'Negative' : 'Indeterminate', style: 'tableCell' },
        { text: parsedReport.er.percentage || 'N/A', style: 'tableCell' },
        { text: parsedReport.er.intensity || 'N/A', style: 'tableCell' }
      ]);
    }

    if (parsedReport.pr) {
      tableBody.push([
        { text: 'PR', style: 'tableCell' },
        { text: getMarkerStatus(parsedReport.pr.percentage, 'PR') === 'Positive' ? 'Positive' : getMarkerStatus(parsedReport.pr.percentage, 'PR') === 'Low Positive' ? 'Low Positive' : getMarkerStatus(parsedReport.pr.percentage, 'PR') === 'Negative' ? 'Negative' : 'Indeterminate', style: 'tableCell' },
        { text: parsedReport.pr.percentage || 'N/A', style: 'tableCell' },
        { text: parsedReport.pr.intensity || 'N/A', style: 'tableCell' }
      ]);
    }

    if (parsedReport.her2) {
      tableBody.push([
        { text: 'HER2', style: 'tableCell' },
        { text: parsedReport.her2.interpretation || 'N/A', style: 'tableCell' },
        { text: parsedReport.her2.percentage || 'N/A', style: 'tableCell' },
        { text: '—', style: 'tableCell' }
      ]);
    }

    if (parsedReport.ki67) {
      tableBody.push([
        { text: 'Ki-67', style: 'tableCell' },
        { text: parsedReport.ki67, style: 'tableCell' },
        { text: parsedReport.ki67, style: 'tableCell' },
        { text: '—', style: 'tableCell' }
      ]);
    }

    content.push(
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 15, 0, 15] },
      { text: 'Summary and Interpretation', style: 'sectionHeader', margin: [0, 0, 0, 10] },
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          headerRows: 1,
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex: number) {
            return (rowIndex === 0) ? '#1e3a8a' : (rowIndex % 2 === 0) ? '#f3f4f6' : null;
          },
          hLineWidth: function () { return 0.5; },
          vLineWidth: function () { return 0.5; },
          hLineColor: function () { return '#d1d5db'; },
          vLineColor: function () { return '#d1d5db'; }
        }
      }
    );
  }

  // Conclusion
  if (parsedReport.conclusion) {
    content.push(
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 15, 0, 15] },
      { text: 'Conclusion', style: 'sectionHeader', margin: [0, 0, 0, 5] },
      { text: parsedReport.conclusion, style: 'fieldValue', margin: [0, 0, 0, 10] }
    );
  }

  // Disclaimer
  content.push(
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 15, 0, 15] },
    {
      text: 'Disclaimer: Results should be correlated with histopathological findings and clinical data. This report is generated by automated image analysis and must be reviewed by a qualified pathologist.',
      style: 'disclaimer',
      alignment: 'center',
      margin: [0, 10, 0, 0]
    }
  );

  // Define PDF document
  const documentDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    content: content,
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: '#1e3a8a'
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#1e40af',
        decoration: 'underline'
      },
      markerTitle: {
        fontSize: 14,
        bold: true,
        color: '#1e40af'
      },
      subsectionTitle: {
        fontSize: 12,
        bold: true,
        color: '#374151'
      },
      fieldLabel: {
        fontSize: 10,
        bold: true,
        color: '#4b5563'
      },
      fieldValue: {
        fontSize: 10,
        color: '#1f2937'
      },
      comment: {
        fontSize: 9,
        italics: true,
        color: '#6b7280',
        background: '#fef3c7',
        margin: [5, 5, 5, 5]
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: '#ffffff',
        fillColor: '#1e3a8a',
        alignment: 'center'
      },
      tableCell: {
        fontSize: 9,
        alignment: 'center'
      },
      disclaimer: {
        fontSize: 8,
        italics: true,
        color: '#6b7280'
      }
    },
    defaultStyle: {
      font: 'Roboto'
    },
    footer: function(currentPage: number, pageCount: number) {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        color: '#9ca3af',
        margin: [0, 10, 0, 0]
      };
    }
  };

  // Generate and open PDF
  pdfMake.createPdf(documentDefinition).open();
}


