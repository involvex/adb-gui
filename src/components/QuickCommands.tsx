import { useState, useEffect, useCallback, useRef } from "react";
import { adbService } from "../adbService";
import { quickCommandsStore, type QuickCommand } from "../electronStore";
import { settingsStore } from "../appSettings";

const QuickCommands: React.FC = () => {
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingCmd, setEditingCmd] = useState<QuickCommand | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("⚡");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPrompt, setShowPrompt] = useState(false);
  const [promptCmd, setPromptCmd] = useState<QuickCommand | null>(null);
  const [promptPlaceholders, setPromptPlaceholders] = useState<
    { name: string; hint: string; value: string }[]
  >([]);
  const promptInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadCommands = useCallback(() => {
    setLoading(true);
    try {
      setCommands(quickCommandsStore.getAll());
    } catch {
      setError("Failed to load commands");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  const extractPlaceholders = (cmd: string): string[] => {
    const matches = cmd.match(/<([^>]+)>/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  };

  const openPromptModal = (cmd: QuickCommand) => {
    const placeholders = extractPlaceholders(cmd.command);
    if (placeholders.length === 0) {
      executeCommand(cmd.command);
      return;
    }

    const settings = settingsStore.get();
    const labels = cmd.placeholderLabels || [];

    const fields = placeholders.map((ph) => {
      const label = labels.find((l) => l.name === ph);
      const isLocalPath =
        ph.toLowerCase().includes("local") || ph.toLowerCase().includes("path");
      const defaultValue =
        isLocalPath && settings.defaultLocalDir ? settings.defaultLocalDir : "";

      return {
        name: ph,
        hint: label?.hint || `Enter ${ph}`,
        value: defaultValue,
      };
    });

    setPromptCmd(cmd);
    setPromptPlaceholders(fields);
    setShowPrompt(true);

    setTimeout(() => {
      promptInputRefs.current[0]?.focus();
    }, 50);
  };

  const executeCommand = async (finalCmd: string) => {
    try {
      await adbService.execute(finalCmd);
    } catch {
      setError(`Failed to execute command`);
    }
  };

  const handlePromptSubmit = async () => {
    if (!promptCmd) return;

    const hasEmpty = promptPlaceholders.some((p) => !p.value.trim());
    if (hasEmpty) {
      setError("All fields are required");
      return;
    }

    let finalCmd = promptCmd.command;
    for (const ph of promptPlaceholders) {
      finalCmd = finalCmd.replace(
        new RegExp(`<${ph.name}>`, "g"),
        ph.value.trim(),
      );
    }

    setShowPrompt(false);
    setPromptCmd(null);
    setError(null);
    await executeCommand(finalCmd);
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx < promptPlaceholders.length - 1) {
        promptInputRefs.current[idx + 1]?.focus();
      } else {
        handlePromptSubmit();
      }
    }
    if (e.key === "Escape") {
      setShowPrompt(false);
      setPromptCmd(null);
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const next = (idx + 1) % promptPlaceholders.length;
      promptInputRefs.current[next]?.focus();
    }
  };

  const handleReset = () => {
    const reset = quickCommandsStore.reset();
    setCommands(reset);
  };

  const openAddModal = () => {
    setEditingCmd(null);
    setFormTitle("");
    setFormCommand("");
    setFormDescription("");
    setFormIcon("⚡");
    setShowModal(true);
  };

  const openEditModal = (cmd: QuickCommand) => {
    setEditingCmd(cmd);
    setFormTitle(cmd.title);
    setFormCommand(cmd.command);
    setFormDescription(cmd.description);
    setFormIcon(cmd.icon);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formCommand.trim()) {
      setError("Title and command are required");
      return;
    }

    if (editingCmd) {
      const updated = quickCommandsStore.update({
        ...editingCmd,
        title: formTitle.trim(),
        command: formCommand.trim(),
        description: formDescription.trim(),
        icon: formIcon,
      });
      setCommands(updated);
    } else {
      const newCmd: QuickCommand = {
        id: `cmd-${Date.now()}`,
        title: formTitle.trim(),
        command: formCommand.trim(),
        description: formDescription.trim(),
        icon: formIcon,
      };
      const updated = quickCommandsStore.add(newCmd);
      setCommands(updated);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this command?")) {
      const updated = quickCommandsStore.remove(id);
      setCommands(updated);
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(commands, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adb-gui-commands.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) {
          setError("Invalid JSON format");
          return;
        }
        for (const cmd of imported) {
          if (!cmd.id || !cmd.title || !cmd.command) {
            setError("Invalid command format in JSON");
            return;
          }
        }
        let allCommands = quickCommandsStore.getAll();
        for (const cmd of imported) {
          if (!allCommands.find((c) => c.id === cmd.id)) {
            allCommands = quickCommandsStore.add(cmd);
          }
        }
        setCommands(allCommands);
        setError(null);
      } catch {
        setError("Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-100">Quick Commands</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleReset}
            className="bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition-colors text-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-blue-900/30 text-blue-300 px-3 py-1 rounded hover:bg-blue-900/50 transition-colors text-sm font-medium border border-blue-800"
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-gray-400 text-sm py-4 text-center">
          Loading commands...
        </div>
      )}

      {!loading && commands.length === 0 && (
        <div className="text-gray-500 text-sm py-4 text-center">
          No commands configured. Click + Add to create one.
        </div>
      )}

      {!loading && commands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {commands.map((cmd) => (
            <div
              key={cmd.id}
              className="group bg-gray-800 border border-gray-700 rounded px-3 py-1.5 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => openPromptModal(cmd)}
                className="text-gray-200 hover:text-gray-100 text-sm font-medium"
                title={cmd.description}
              >
                <span className="mr-1">{cmd.icon}</span>
                {cmd.title}
              </button>
              <button
                type="button"
                onClick={() => openEditModal(cmd)}
                className="text-gray-500 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(cmd.id)}
                className="text-gray-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Del
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Prompt Modal */}
      {showPrompt && promptCmd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label={`Configure ${promptCmd.title}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{promptCmd.icon}</span>
              <h3 className="text-lg font-semibold text-gray-100">
                {promptCmd.title}
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {promptCmd.description}
            </p>

            <div className="space-y-3">
              {promptPlaceholders.map((ph, idx) => (
                <div key={ph.name}>
                  <label
                    htmlFor={`prompt-${ph.name}`}
                    className="block text-xs text-gray-400 mb-1"
                  >
                    {ph.name}
                  </label>
                  <input
                    id={`prompt-${ph.name}`}
                    ref={(el) => {
                      promptInputRefs.current[idx] = el;
                    }}
                    type="text"
                    value={ph.value}
                    onChange={(e) => {
                      const updated = [...promptPlaceholders];
                      updated[idx] = { ...updated[idx], value: e.target.value };
                      setPromptPlaceholders(updated);
                    }}
                    onKeyDown={(e) => handlePromptKeyDown(e, idx)}
                    placeholder={ph.hint}
                    className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-gray-500 transition-colors"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPrompt(false);
                  setPromptCmd(null);
                }}
                className="bg-gray-700 text-gray-300 px-4 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromptSubmit}
                className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors text-sm font-medium"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              {editingCmd ? "Edit Command" : "Add Command"}
            </h3>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="cmd-icon"
                  className="block text-xs text-gray-400 mb-1"
                >
                  Icon (emoji)
                </label>
                <input
                  id="cmd-icon"
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500"
                  maxLength={4}
                />
              </div>

              <div>
                <label
                  htmlFor="cmd-title"
                  className="block text-xs text-gray-400 mb-1"
                >
                  Title
                </label>
                <input
                  id="cmd-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500"
                  placeholder="My Command"
                />
              </div>

              <div>
                <label
                  htmlFor="cmd-command"
                  className="block text-xs text-gray-400 mb-1"
                >
                  Command
                </label>
                <input
                  id="cmd-command"
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-gray-500"
                  placeholder="shell pm list packages -3"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Use {"<placeholder>"} for variables (e.g., {"<package>"})
                </p>
              </div>

              <div>
                <label
                  htmlFor="cmd-description"
                  className="block text-xs text-gray-400 mb-1"
                >
                  Description
                </label>
                <input
                  id="cmd-description"
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-3 py-2 text-sm outline-none focus:border-gray-500"
                  placeholder="What this command does"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-gray-700 text-gray-300 px-4 py-2 rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="bg-blue-900/50 text-blue-300 px-4 py-2 rounded hover:bg-blue-900/70 transition-colors text-sm font-medium border border-blue-800"
              >
                {editingCmd ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickCommands;
