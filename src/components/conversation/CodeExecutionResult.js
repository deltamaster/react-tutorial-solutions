import * as Icon from "react-bootstrap-icons";

/**
 * Code execution result component
 * Displays the output of executed code blocks
 */
const CodeExecutionResult = ({ result }) => {
  const isSuccess = result.outcome === "OUTCOME_OK";

  return (
    <div className="code-block">
      <div className="code-block-title">
        <Icon.Terminal size={16} className="mr-2" />
        Execution Result ({isSuccess ? "Success" : "Error"})
      </div>
      <pre className={isSuccess ? "execution-result" : "execution-error"}>
        {result.output}
      </pre>
    </div>
  );
};

export default CodeExecutionResult;
