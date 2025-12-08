const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.generateProposalPDF = (proposalId, clientName, items, totalAmount) => {
  return new Promise((resolve, reject) => {
    try {
      // 1. Setup document with explicit zero bottom margin to allow footer
      // Removing the generic 'margin: 50' to prevent conflict
      const doc = new PDFDocument({ 
        size: 'A4', 
        bufferPages: true, 
        autoFirstPage: true,
        margins: { top: 50, left: 50, right: 50, bottom: 0 } 
      });

      const fileName = `proposal-${proposalId}-${Date.now()}.pdf`;
      const uploadDir = path.join(__dirname, "../../uploads/proposals");

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // --- THEME CONSTANTS ---
      const primaryColor = "#0D1B2A"; 
      const accentColor = "#2EC4B6";  
      const greyText = "#64748B";     
      const darkText = "#1E293B";     
      const lightBg = "#F8FAFC";      
      const tableHeaderBg = "#F1F5F9"; 
      const borderColor = "#E2E8F0";  
      
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      // Define a safe content limit well above footer (footer starts approx 800)
      const contentBottomLimit = 750; 

      // --- HEADER SECTION ---
      doc.rect(0, 0, pageWidth, 12).fill(accentColor);
      doc.rect(0, 12, pageWidth, 128).fill(primaryColor);

      doc.fillColor("#FFFFFF").fontSize(26).font("Helvetica-Bold")
         .text("BizTech", margin, 55);
      
      const logoWidth = doc.widthOfString("BizTech");
      doc.fillColor(accentColor).text("Biz Digital", margin + logoWidth + 6, 55);

      doc.fillColor("#94A3B8").fontSize(10).font("Helvetica")
         .text("Agency Management Portal", margin, 90);

      doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold")
         .text("PROPOSAL", 0, 55, { align: "right", width: pageWidth - margin });

      doc.fillColor(accentColor).fontSize(20).font("Helvetica")
         .text(`#${proposalId}`, 0, 75, { align: "right", width: pageWidth - margin });

      // --- INFO SECTION ---
      let yPos = 180;

      // Left Column
      doc.rect(margin, yPos, 260, 95).fill(lightBg); 
      doc.rect(margin, yPos, 4, 95).fill(accentColor); 

      doc.fillColor(greyText).fontSize(9).font("Helvetica-Bold")
         .text("PREPARED FOR", margin + 20, yPos + 20);

      doc.fillColor(darkText).fontSize(14).font("Helvetica-Bold")
         .text(clientName, margin + 20, yPos + 40);

      doc.fillColor(greyText).fontSize(10).font("Helvetica")
         .text("Valued Client", margin + 20, yPos + 60);

      // Right Column
      const col2X = 350;
      const drawDetailRow = (label, value, y) => {
        doc.fillColor(greyText).fontSize(10).font("Helvetica").text(label, col2X, y);
        doc.fillColor(darkText).fontSize(10).font("Helvetica-Bold").text(value, col2X + 100, y, { align: 'right', width: 95 });
      };

      drawDetailRow("Date Issued:", new Date().toLocaleDateString(), yPos + 20);
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 14);
      drawDetailRow("Valid Until:", validDate.toLocaleDateString(), yPos + 45);
      drawDetailRow("Project Type:", "Digital Services", yPos + 70);

      // --- TABLE SECTION ---
      yPos += 120;
      
      const itemColX = margin + 15;
      const amountColX = pageWidth - margin - 100;
      const amountColWidth = 85;

      const drawTableHeader = (y) => {
        doc.rect(margin, y, pageWidth - (margin * 2), 35).fill(tableHeaderBg);
        doc.fillColor(greyText).fontSize(9).font("Helvetica-Bold");
        doc.text("DESCRIPTION", itemColX, y + 13);
        doc.text("AMOUNT", amountColX, y + 13, { width: amountColWidth, align: "right" });
      };

      drawTableHeader(yPos);
      yPos += 35;

      doc.font("Helvetica").fontSize(10);

      items.forEach((item) => {
        const itemHeight = 45; 
        
        if (yPos + itemHeight > contentBottomLimit) {
            doc.addPage();
            yPos = 50; 
            drawTableHeader(yPos);
            yPos += 35;
            doc.font("Helvetica").fontSize(10);
        }

        doc.moveTo(margin, yPos + itemHeight)
           .lineTo(pageWidth - margin, yPos + itemHeight)
           .strokeColor(borderColor).lineWidth(0.5).stroke();

        doc.fillColor(darkText);
        
        const textY = yPos + 16;
        doc.text(item.description, itemColX, textY);
        doc.text(`$${Number(item.price).toFixed(2)}`, amountColX, textY, { width: amountColWidth, align: "right" });
        
        yPos += itemHeight;
      });

      // --- TOTALS SECTION ---
      yPos += 20;
      
      if (yPos + 100 > contentBottomLimit) {
          doc.addPage();
          yPos = 50;
      }

      const totalBoxX = pageWidth - margin - 240;
      const totalBoxWidth = 240;

      doc.fillColor(greyText).fontSize(10).font("Helvetica");
      doc.text("Subtotal", totalBoxX + 15, yPos);
      doc.fillColor(darkText).text(`$${Number(totalAmount).toFixed(2)}`, amountColX, yPos, { width: amountColWidth, align: "right" });
      
      yPos += 20;

      doc.fillColor(greyText).text("Tax (0%)", totalBoxX + 15, yPos);
      doc.fillColor(darkText).text("$0.00", amountColX, yPos, { width: amountColWidth, align: "right" });

      yPos += 25;

      doc.rect(totalBoxX, yPos - 10, totalBoxWidth, 50).fill(primaryColor);
      
      doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold");
      doc.text("Total Estimate", totalBoxX + 20, yPos + 8);
      
      doc.fillColor(accentColor).fontSize(16).font("Helvetica-Bold");
      doc.text(`$${Number(totalAmount).toFixed(2)}`, amountColX, yPos + 6, { width: amountColWidth, align: "right" });

      yPos += 60;

      // --- TERMS SECTION ---
      yPos += 30;

      if (yPos + 100 > contentBottomLimit) {
          doc.addPage();
          yPos = 50;
      }
      
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("Terms & Conditions", margin, yPos);
      
      doc.rect(margin, yPos + 15, 30, 3).fill(accentColor); 

      doc.fillColor(greyText).fontSize(9).font("Helvetica")
         .text("1. Payment Terms: 50% upfront deposit required to commence work.", margin, yPos + 30)
         .text("2. Validity: This proposal is valid for 14 days from the date of issue.", margin, yPos + 45)
         .text("3. Delivery: Final assets transferred upon full payment completion.", margin, yPos + 60);

      // --- FOOTER (Applied to all pages) ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Use a safe vertical position for footer
        const footerY = 800; 
        
        // Draw background
        doc.rect(0, footerY, pageWidth, 42).fill(lightBg);
        doc.moveTo(0, footerY).lineTo(pageWidth, footerY).strokeColor(borderColor).stroke();
        
        // Draw text
        // Ensure fill color is set explicitly
        doc.fillColor(greyText).opacity(1); 
        
        // Use absolute positioning with 'lineBreak: false' to prevent wrapping/breaking issues
        doc.fontSize(8).font("Helvetica")
           .text(
             "services@biztech.ae  •  +971 50 328 8786  •  www.biztech.ae", 
             0, 
             footerY + 16, 
             { 
               align: "center", 
               width: pageWidth,
               lineBreak: false 
             }
           );
      }

      doc.end();

      writeStream.on("finish", () => {
        resolve(`uploads/proposals/${fileName}`);
      });

      writeStream.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};