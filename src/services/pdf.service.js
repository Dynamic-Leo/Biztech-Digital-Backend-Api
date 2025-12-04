const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.generateProposalPDF = (proposalId, clientName, items, totalAmount) => {
  return new Promise((resolve, reject) => {
    try {
      // Create document with margins
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
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
      const primaryColor = "#0D1B2A"; // Dark Blue
      const accentColor = "#2EC4B6";  // Teal
      const greyColor = "#4A5568";
      const lightGrey = "#F5F7FA";
      const white = "#FFFFFF";

      // --- HEADER SECTION ---
      // Draw top background rect
      doc.rect(0, 0, 595.28, 120).fill(primaryColor);
      
      // Company Name
      doc.fillColor(white).fontSize(26).font("Helvetica-Bold")
         .text("BizTech Biz Digital", 50, 40);
      
      // Subtitle
      doc.fillColor(accentColor).fontSize(10).font("Helvetica")
         .text("Agency Management Portal", 50, 75);

      // "PROPOSAL" Label
      doc.fillColor(white).fontSize(36).font("Helvetica-Bold")
         .text("PROPOSAL", 0, 40, { align: "right", width: 545.28 }); // 595 - 50 margin

      // --- INFO SECTION ---
      const yPos = 160;
      
      // Left Column: Prepared For
      doc.fillColor(greyColor).fontSize(10).font("Helvetica-Bold").text("PREPARED FOR", 50, yPos);
      doc.rect(50, yPos + 12, 200, 1).fill(accentColor); // Underline
      
      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold").text(clientName, 50, yPos + 25);
      doc.fillColor(greyColor).fontSize(10).font("Helvetica").text("Valued Client", 50, yPos + 40);

      // Right Column: Proposal Details
      doc.fillColor(greyColor).fontSize(10).font("Helvetica-Bold").text("PROPOSAL DETAILS", 350, yPos);
      doc.rect(350, yPos + 12, 195, 1).fill(accentColor); // Underline

      const detailsY = yPos + 25;
      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold");
      doc.text("Proposal ID:", 350, detailsY);
      doc.text("Date:", 350, detailsY + 15);
      doc.text("Valid Until:", 350, detailsY + 30);

      doc.fillColor(greyColor).font("Helvetica");
      doc.text(`#${proposalId}`, 450, detailsY, { align: 'right', width: 95 });
      doc.text(new Date().toLocaleDateString(), 450, detailsY + 15, { align: 'right', width: 95 });
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 14);
      doc.text(validDate.toLocaleDateString(), 450, detailsY + 30, { align: 'right', width: 95 });

      doc.moveDown(4);

      // --- TABLE SECTION ---
      const tableTop = 270;
      
      // Table Header Background
      doc.rect(50, tableTop, 495, 30).fill(primaryColor);
      
      // Table Header Text
      doc.fillColor(white).fontSize(10).font("Helvetica-Bold");
      doc.text("DESCRIPTION", 65, tableTop + 10);
      doc.text("AMOUNT", 450, tableTop + 10, { width: 90, align: "right" });

      // --- TABLE ITEMS ---
      let y = tableTop + 30;
      doc.font("Helvetica").fontSize(10);

      items.forEach((item, index) => {
        // Stripe background for alternate rows
        if (index % 2 === 0) {
            doc.rect(50, y, 495, 30).fill(lightGrey);
        } else {
            // Ensure white background implicitly or fill white if needed
        }

        // Reset fill color for text
        doc.fillColor("#333333");

        // Vertical alignment calculation
        const textY = y + 10;

        doc.text(item.description, 65, textY);
        doc.text(`$${Number(item.price).toFixed(2)}`, 450, textY, { width: 90, align: "right" });
        
        y += 30;
      });

      // Bottom line of table
      doc.rect(50, y, 495, 1).fill(greyColor);

      // --- TOTALS SECTION ---
      y += 20;
      const totalBoxTop = y;
      
      // Total Box Background
      doc.rect(350, totalBoxTop, 195, 45).fill(accentColor);
      
      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL ESTIMATE", 370, totalBoxTop + 16);
      
      doc.fillColor(white).fontSize(16).font("Helvetica-Bold");
      doc.text(`$${Number(totalAmount).toFixed(2)}`, 450, totalBoxTop + 14, { width: 80, align: "right" });

      // --- FOOTER / TERMS ---
      const bottomPage = 680;
      
      doc.rect(50, bottomPage, 495, 2).fill(primaryColor);
      
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("Terms & Conditions", 50, bottomPage + 15);
      
      doc.fillColor(greyColor).fontSize(9).font("Helvetica")
         .text("1. A 50% deposit is required to commence work on the project.", 50, bottomPage + 30)
         .text("2. This proposal is valid for 14 days from the date of issue.", 50, bottomPage + 45)
         .text("3. All deliverables will be transferred upon final payment.", 50, bottomPage + 60);

      // Company Footer
      const footerY = 760;
      doc.rect(0, footerY, 595.28, 842 - footerY).fill(primaryColor); // Bottom bar
      
      doc.fillColor(white).fontSize(10).font("Helvetica-Bold")
         .text("BizTech Biz Digital", 0, footerY + 15, { align: "center" });
      
      doc.fillColor(accentColor).fontSize(9).font("Helvetica")
         .text("services@biztech.ae  |  +971 50 328 8786  |  www.biztech.ae", 0, footerY + 30, { align: "center" });

      doc.end();

      writeStream.on("finish", () => {
        // Return relative path for DB storage
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