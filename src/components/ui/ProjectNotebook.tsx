"use client";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  InputNumber,
  Progress,
  Select,
  Tabs,
  Typography,
  theme,
} from "antd";
import { Plus, Trash2, Undo2, Check } from "lucide-react";
import { useState } from "react";
import { Stagger, Reveal } from "@/components/motion";
import { useI18n } from "@/i18n";
import type { ProjectWorkspace } from "@/features/projects/domain";
import type { Currency } from "@/features/prices/domain";

export interface ProjectNotebookProps {
  value: ProjectWorkspace;
  currency: Currency;
  editable?: boolean;
  busy?: boolean;
  inventory?: { id: string; name: string; unit: string; quantity: number }[];
  onChange: (patch: Partial<ProjectWorkspace>) => Promise<boolean>;
  onMaterial?: (
    id: string,
    quantity: number,
    cost?: number,
  ) => Promise<boolean>;
  onConsume?: (id: string, reverse?: boolean) => Promise<boolean>;
}
/** Project workbench shared by the app and the design reference. */
export function ProjectNotebook({
  value,
  currency,
  editable,
  busy,
  inventory = [],
  onChange,
  onMaterial,
  onConsume,
}: ProjectNotebookProps) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [tab, setTab] = useState("tasks");
  const [form] = Form.useForm();
  const tasks = value.tasks ?? [];
  const journal = value.journal ?? [];
  const expenses = value.expenses ?? [];
  const contacts = value.contacts ?? [];
  const materials = value.materials ?? [];
  const id = () => crypto.randomUUID();
  const remove = (
    key: "tasks" | "journal" | "expenses" | "contacts",
    rowId: string,
  ) => onChange({ [key]: value[key]?.filter((row) => row.id !== rowId) });
  async function add(values: Record<string, string | number>) {
    let saved = false;
    const text = String(values.text ?? "").trim();
    if (tab === "tasks")
      saved = await onChange({
        tasks: [
          ...tasks,
          {
            id: id(),
            text,
            done: false,
            due: String(values.date || ""),
            responsible: String(values.person || ""),
          },
        ],
      });
    if (tab === "journal")
      saved = await onChange({
        journal: [
          ...journal,
          {
            id: id(),
            text,
            kind: (values.kind || "note") as "note" | "idea" | "decision",
            at: Date.now(),
            author: String(values.person || ""),
          },
        ],
      });
    if (tab === "expenses")
      saved = await onChange({
        expenses: [
          ...expenses,
          {
            id: id(),
            label: text,
            cents: Math.round(Number(values.amount) * 100),
            date: String(values.date || dayjs().format("YYYY-MM-DD")),
          },
        ],
      });
    if (tab === "contacts")
      saved = await onChange({
        contacts: [
          ...contacts,
          {
            id: id(),
            name: text,
            role: String(values.person || ""),
            details: String(values.details || ""),
          },
        ],
      });
    if (tab === "materials" && onMaterial)
      saved = await onMaterial(
        String(values.item),
        Number(values.quantity),
        values.amount === undefined || values.amount === null
          ? undefined
          : Math.round(Number(values.amount) * 100),
      );
    if (saved) form.resetFields();
  }
  const erase = (
    key: "tasks" | "journal" | "expenses" | "contacts",
    rowId: string,
  ) =>
    editable && (
      <Button
        type="text"
        danger
        disabled={busy}
        icon={<Trash2 />}
        aria-label={t("common.delete")}
        onClick={() => void remove(key, rowId)}
      />
    );
  const rowStyle = {
    paddingBlock: token.paddingSM,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  };
  const body = (key: string) => (
    <Stagger>
      {key === "tasks" && (
        <>
          <Progress
            percent={
              tasks.length
                ? Math.round(
                    (tasks.filter((task) => task.done).length / tasks.length) *
                      100,
                  )
                : 0
            }
          />
          {tasks.map((task) => (
            <Reveal key={task.id}>
              <Flex align="center" gap={token.marginSM} style={rowStyle}>
                <Checkbox
                  checked={task.done}
                  disabled={!editable || busy}
                  onChange={(e) =>
                    void onChange({
                      tasks: tasks.map((row) =>
                        row.id === task.id
                          ? { ...row, done: e.target.checked }
                          : row,
                      ),
                    })
                  }
                >
                  <Typography.Text delete={task.done}>
                    {task.text}
                  </Typography.Text>
                </Checkbox>
                <Typography.Text type="secondary">
                  {[task.responsible, task.due].filter(Boolean).join(" · ")}
                </Typography.Text>
                {erase("tasks", task.id)}
              </Flex>
            </Reveal>
          ))}
        </>
      )}
      {key === "journal" &&
        [...journal].reverse().map((note) => (
          <Reveal key={note.id}>
            <Flex justify="space-between" style={rowStyle}>
              <div>
                <Typography.Text type="secondary">
                  {t(`projects.kind.${note.kind}`)} ·{" "}
                  {new Date(note.at).toLocaleDateString()} · {note.author}
                </Typography.Text>
                <Typography.Paragraph
                  style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}
                >
                  {note.text}
                </Typography.Paragraph>
              </div>
              {erase("journal", note.id)}
            </Flex>
          </Reveal>
        ))}
      {key === "expenses" && (
        <>
          <Typography.Paragraph type="secondary">
            {t("projects.expenseHint")}
          </Typography.Paragraph>
          {expenses.map((expense) => (
            <Reveal key={expense.id}>
              <Flex justify="space-between" wrap style={rowStyle}>
                <Typography.Text>
                  {expense.label} · {expense.date}
                </Typography.Text>
                <Typography.Text strong>
                  {format.money(expense.cents, currency)}
                </Typography.Text>
                {erase("expenses", expense.id)}
              </Flex>
            </Reveal>
          ))}
        </>
      )}
      {key === "contacts" &&
        contacts.map((contact) => (
          <Reveal key={contact.id}>
            <Flex justify="space-between" style={rowStyle}>
              <div>
                <Typography.Text strong>
                  {contact.name} · {contact.role}
                </Typography.Text>
                <Typography.Paragraph
                  style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}
                >
                  {contact.details}
                </Typography.Paragraph>
              </div>
              {erase("contacts", contact.id)}
            </Flex>
          </Reveal>
        ))}
      {key === "materials" && (
        <>
          <Typography.Paragraph type="secondary">
            {t("projects.materialHint")}
          </Typography.Paragraph>
          {materials.map((material) => (
            <Reveal key={material.id}>
              <Flex
                justify="space-between"
                align="center"
                wrap
                gap={token.marginSM}
                style={rowStyle}
              >
                <div>
                  <Typography.Text strong>{material.name}</Typography.Text>
                  <div>
                    {material.quantity} {material.unit} ·{" "}
                    {t(
                      material.reversedAt
                        ? "projects.reversed"
                        : material.used
                          ? "projects.used"
                          : "projects.planned",
                    )}
                    {material.costCents !== undefined &&
                      ` · ${format.money(material.costCents, currency)}`}
                  </div>
                </div>
                {editable && !material.used && (
                  <Button
                    type="text"
                    danger
                    disabled={busy}
                    icon={<Trash2 />}
                    aria-label={t("common.delete")}
                    onClick={() =>
                      void onChange({
                        materials: materials.filter(
                          (row) => row.id !== material.id,
                        ),
                      })
                    }
                  />
                )}
                {editable && !material.reversedAt && (
                  <Button
                    disabled={busy}
                    icon={material.used ? <Undo2 /> : <Check />}
                    onClick={() => void onConsume?.(material.id, material.used)}
                  >
                    {t(material.used ? "projects.reverse" : "projects.consume")}
                  </Button>
                )}
              </Flex>
            </Reveal>
          ))}
        </>
      )}
    </Stagger>
  );
  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={(key) => {
          setTab(key);
          form.resetFields();
        }}
        items={(
          ["tasks", "journal", "materials", "expenses", "contacts"] as const
        ).map((key) => ({
          key,
          label: t(`projects.section.${key}`),
          children: body(key),
        }))}
      />
      {editable && (
        <Form
          form={form}
          layout="vertical"
          onFinish={add}
          disabled={busy}
          initialValues={{ quantity: 1, kind: "note" }}
        >
          {tab !== "materials" && (
            <Form.Item
              name="text"
              label={t(
                tab === "contacts"
                  ? "projects.contactName"
                  : "projects.entryText",
              )}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input.TextArea
                maxLength={tab === "journal" ? 2000 : 500}
                autoSize={{ minRows: 1, maxRows: 5 }}
              />
            </Form.Item>
          )}
          {tab === "journal" && (
            <Form.Item name="kind" label={t("projects.entryKind")}>
              <Select
                options={(["note", "idea", "decision"] as const).map((key) => ({
                  value: key,
                  label: t(`projects.kind.${key}`),
                }))}
              />
            </Form.Item>
          )}
          {["tasks", "contacts", "journal"].includes(tab) && (
            <Form.Item
              name="person"
              label={t(
                tab === "contacts"
                  ? "projects.contactRole"
                  : "projects.responsible",
              )}
            >
              <Input maxLength={120} />
            </Form.Item>
          )}
          {tab === "contacts" && (
            <Form.Item name="details" label={t("projects.contactDetails")}>
              <Input.TextArea maxLength={500} />
            </Form.Item>
          )}
          {["tasks", "expenses"].includes(tab) && (
            <Form.Item name="date" label={t("projects.date")}>
              <Input type="date" />
            </Form.Item>
          )}
          {tab === "materials" && (
            <>
              <Form.Item
                name="item"
                label={t("projects.product")}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={inventory.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.quantity} ${item.unit}`,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="quantity"
                label={t("projects.quantity")}
                rules={[{ required: true }]}
              >
                <InputNumber min={0.001} max={100000} precision={3} />
              </Form.Item>
            </>
          )}
          {["materials", "expenses"].includes(tab) && (
            <Form.Item
              name="amount"
              label={t("projects.amount", { currency })}
              rules={tab === "expenses" ? [{ required: true }] : []}
            >
              <InputNumber min={0} max={10000000} precision={2} />
            </Form.Item>
          )}
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            icon={<Plus />}
          >
            {t("projects.addEntry")}
          </Button>
        </Form>
      )}
    </Card>
  );
}
