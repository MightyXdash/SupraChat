import { useState, useRef, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Check, Cloud, Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react"
import { useCloudModelsStore } from "@/features/cloud-models/store/use-cloud-models-store"
import { cloudModelProviders, getProvider } from "@/features/cloud-models/config/providers"
import { cloudModelsConfig } from "@/features/cloud-models/config/cloud-models"
import { isReasoningCapableModel } from "@/features/cloud-models/lib/reasoning"
import type { CloudModelInstance, CloudModelProviderId } from "@/features/cloud-models/types/cloud-models"
import { useConfirmationDialog } from "@/app/components/ConfirmationDialog"

type Page = "list" | "form"

export function CloudModelsTab() {
  const [page, setPage] = useState<Page>("list")
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null)
  const instances = useCloudModelsStore((state) => state.instances)
  const removeInstance = useCloudModelsStore((state) => state.removeInstance)
  const { confirm, confirmationDialog } = useConfirmationDialog()

  async function handleRemoveInstance(instance: CloudModelInstance) {
    const shouldRemove = await confirm({
      body: `This will remove the ${instance.label} instance and its configured models.`,
      confirmLabel: "Remove",
      title: "Remove cloud model instance?",
      tone: "danger",
    })

    if (shouldRemove) {
      removeInstance(instance.id)
    }
  }

  function handleEditInstance(instance: CloudModelInstance) {
    setEditingInstanceId(instance.id)
    setPage("form")
  }

  function handleAddInstance() {
    setEditingInstanceId(null)
    setPage("form")
  }

  function handleFormClose() {
    setEditingInstanceId(null)
    setPage("list")
  }

  const totalModels = instances.reduce((count, i) => count + i.modelIds.length, 0)

  return (
    <>
      {page === "list" ? (
        <motion.div
          className="cloud-models-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="cloud-models-list-header">
            <div>
              <h3 className="cloud-models-list-title">Instances</h3>
              <p className="cloud-models-list-subtitle">
                {instances.length === 0
                  ? "No instances configured"
                  : `${instances.length} instance${instances.length === 1 ? "" : "s"} · ${totalModels} model${totalModels === 1 ? "" : "s"}`}
              </p>
            </div>
            {instances.length > 0 ? (
              <button
                className="cloud-models-add-button"
                type="button"
                onClick={handleAddInstance}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Instance
              </button>
            ) : null}
          </div>

          {instances.length === 0 ? (
            <div className="cloud-models-empty-card">
              <div className="cloud-models-empty-icon">
                <Cloud className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="cloud-models-empty-copy">
                <h3>No cloud model instances</h3>
                <p>Add a provider to use cloud models in your conversations. The first four recommended models are added automatically.</p>
              </div>
              <button
                className="cloud-models-add-button"
                type="button"
                onClick={handleAddInstance}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Instance
              </button>
            </div>
          ) : (
            <div className="cloud-models-instance-cards">
              {instances.map((instance) => {
                const provider = getProvider(instance.providerId)
                const reasoningCount = instance.modelIds.filter((id) => isReasoningCapableModel(id)).length

                return (
                  <div
                    key={instance.id}
                    className="cloud-models-instance-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleEditInstance(instance)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleEditInstance(instance)
                      }
                    }}
                  >
                    <div className="cloud-models-instance-card-content">
                      <div className="cloud-models-instance-card-left">
                        <div className="cloud-models-instance-card-icon">
                          <Cloud className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="cloud-models-instance-card-info">
                          <div className="cloud-models-instance-card-name">{instance.label}</div>
                          <div className="cloud-models-instance-card-provider">{provider?.label ?? instance.providerId}</div>
                        </div>
                      </div>
                      <div className="cloud-models-instance-card-right">
                        <span className="cloud-models-instance-card-models">
                          {instance.modelIds.length} model{instance.modelIds.length === 1 ? "" : "s"}
                        </span>
                        {reasoningCount > 0 ? (
                          <span className="cloud-models-instance-card-reasoning">
                            {reasoningCount} reasoning
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="cloud-models-instance-card-models-preview">
                      {instance.modelIds.slice(0, 5).map((modelId) => (
                        <span
                          key={modelId}
                          className={isReasoningCapableModel(modelId) ? "cloud-models-model-chip reasoning" : "cloud-models-model-chip"}
                        >
                          {modelId}
                        </span>
                      ))}
                      {instance.modelIds.length > 5 ? (
                        <span className="cloud-models-model-chip-more">+{instance.modelIds.length - 5} more</span>
                      ) : null}
                    </div>
                    <div className="cloud-models-instance-card-actions">
                      <button
                        className="cloud-models-instance-card-delete"
                        type="button"
                        aria-label={`Remove ${instance.label}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleRemoveInstance(instance)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      ) : (
        <InstanceForm
          editingInstanceId={editingInstanceId}
          onClose={handleFormClose}
        />
      )}

      {confirmationDialog}
    </>
  )
}

type InstanceFormProps = {
  editingInstanceId: string | null
  onClose: () => void
}

function InstanceForm({ editingInstanceId, onClose }: InstanceFormProps) {
  const instances = useCloudModelsStore((state) => state.instances)
  const addInstance = useCloudModelsStore((state) => state.addInstance)
  const updateInstance = useCloudModelsStore((state) => state.updateInstance)

  const editingInstance = editingInstanceId
    ? instances.find((i) => i.id === editingInstanceId) ?? null
    : null

  const [providerId, setProviderId] = useState<CloudModelProviderId>(
    editingInstance?.providerId ?? "openrouter",
  )
  const [label, setLabel] = useState(editingInstance?.label ?? "")
  const [apiKey, setApiKey] = useState(editingInstance?.apiKey ?? "")
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelIdsText, setModelIdsText] = useState(
    editingInstance
      ? editingInstance.modelIds
          .filter((id) => !cloudModelsConfig.autoAddModelIds.includes(id))
          .join("\n")
      : "",
  )
  const labelInputRef = useRef<HTMLInputElement | null>(null)

  const provider = getProvider(providerId)
  const isValid = label.trim().length > 0 && apiKey.trim().length > 0

  useEffect(() => {
    labelInputRef.current?.focus()
  }, [])

  function handleSubmit() {
    const trimmedLabel = label.trim()
    const trimmedApiKey = apiKey.trim()
    const parsedModelIds = modelIdsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (!trimmedLabel || !trimmedApiKey) {
      return
    }

    if (editingInstance) {
      updateInstance(editingInstance.id, {
        label: trimmedLabel,
        apiKey: trimmedApiKey,
        modelIds: [
          ...cloudModelsConfig.autoAddModelIds.filter(
            (id) => !editingInstance.modelIds.includes(id) || editingInstance.modelIds.includes(id),
          ),
          ...parsedModelIds,
        ],
      })
    } else {
      addInstance(providerId, trimmedLabel, trimmedApiKey, parsedModelIds)
    }

    onClose()
  }

  return (
    <motion.div
      className="cloud-models-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <header className="cloud-models-form-header">
        <button
          type="button"
          className="cloud-models-form-back"
          onClick={onClose}
          aria-label="Back to instances"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="cloud-models-form-breadcrumb">
          <span className="cloud-models-form-breadcrumb-muted">Instances</span>
          <span className="cloud-models-form-breadcrumb-sep">/</span>
          <span>{editingInstance ? "Edit" : "New"}</span>
        </div>
      </header>

      <div className="cloud-models-form-section">
        <div className="cloud-models-form-row">
          <label className="cloud-models-form-label">Provider</label>
          <div className="cloud-models-provider-selector">
            {cloudModelProviders.map((providerOption) => (
              <button
                key={providerOption.id}
                className={providerId === providerOption.id ? "active" : ""}
                type="button"
                disabled={editingInstanceId != null}
                onClick={() => {
                  if (!editingInstanceId) setProviderId(providerOption.id)
                }}
              >
                <Cloud className="h-4 w-4" aria-hidden="true" />
                {providerOption.label}
              </button>
            ))}
          </div>
          {provider ? (
            <p className="cloud-models-form-hint">{provider.description}</p>
          ) : null}
        </div>

        <div className="cloud-models-form-row">
          <label className="cloud-models-form-label">Instance Name</label>
          <input
            ref={labelInputRef}
            className="cloud-models-form-input"
            type="text"
            placeholder="My OpenRouter"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="cloud-models-form-row">
          <label className="cloud-models-form-label">
            <Key className="h-3.5 w-3.5" aria-hidden="true" />
            API Key
          </label>
          <p className="cloud-models-form-hint">Stored locally.</p>
          <div className="cloud-models-form-input-wrapper">
            <input
              className="cloud-models-form-input cloud-models-form-input-password"
              type={showApiKey ? "text" : "password"}
              placeholder={provider?.apiKeyPlaceholder ?? "Enter API key"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <button
              type="button"
              className="cloud-models-form-input-eye"
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              aria-pressed={showApiKey}
            >
              {showApiKey ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="cloud-models-form-row">
          <label className="cloud-models-form-label">Additional Model IDs</label>
          <p className="cloud-models-form-hint">
            {provider?.modelIdHelpText ?? "Enter one model ID per line."}
          </p>
          <textarea
            className="cloud-models-form-textarea"
            placeholder="anthropic/claude-3.5-sonnet"
            value={modelIdsText}
            onChange={(event) => setModelIdsText(event.target.value)}
            rows={4}
          />
          <div className="cloud-models-form-auto-notice">
            <Check className="h-3 w-3" aria-hidden="true" />
            <span>Four models are added automatically:</span>
          </div>
          <div className="cloud-models-form-auto-models">
            {cloudModelsConfig.autoAddModelIds.map((modelId) => (
              <code key={modelId}>{modelId}</code>
            ))}
          </div>
        </div>
      </div>

      <div className="cloud-models-form-footer">
        <button
          className="cloud-models-form-cancel"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="cloud-models-form-submit"
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
        >
          {editingInstance ? "Save Changes" : "Create Instance"}
        </button>
      </div>
    </motion.div>
  )
}