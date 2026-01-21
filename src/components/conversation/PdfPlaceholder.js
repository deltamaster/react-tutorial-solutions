import * as Icon from "react-bootstrap-icons";

/**
 * PDF placeholder component to indicate PDF file uploads
 */
const PdfPlaceholder = () => {
  return (
    <div className="pdf-placeholder">
      <Icon.FileEarmarkPdf size={32} color="#dc3545" />
      <div>
        <div className="pdf-title">PDF Document Uploaded</div>
        <div className="pdf-description">
          A PDF file has been uploaded here.
        </div>
      </div>
    </div>
  );
};

export default PdfPlaceholder;
