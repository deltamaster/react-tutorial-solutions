/**
 * Inline image component for displaying images in conversation
 */
const InlineImage = ({ dataUrl, alt = "Generated image" }) => {
  return (
    <div className="image-container">
      <img src={dataUrl} alt={alt} className="conversation-image" />
    </div>
  );
};

export default InlineImage;
