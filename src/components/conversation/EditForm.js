/**
 * Edit form component for editing message content
 */
const EditForm = ({ value, onChange, onSave, onCancel, isItalic = false }) => {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`edit-textarea ${isItalic ? "edit-textarea-italic" : ""}`}
        placeholder="Edit your content here..."
      />
      <div className="button-group">
        <button onClick={onSave} className="save-button">
          Save
        </button>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EditForm;
