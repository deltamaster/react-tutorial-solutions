import * as Icon from "react-bootstrap-icons";

/**
 * Edit button component for message editing
 */
const EditButton = ({ onClick, position = "right" }) => {
  return (
    <button
      onClick={onClick}
      className={`edit-button ${position === "left" ? "edit-button-left" : "edit-button-right"}`}
      title="Edit"
    >
      <Icon.Pencil size={14} />
    </button>
  );
};

export default EditButton;
