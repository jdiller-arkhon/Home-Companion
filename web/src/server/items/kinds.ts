/**
 * Household record kinds. Each kind declares its fields once; the same
 * declaration drives validation, forms, list rendering and AI tool schemas.
 * Promoted fields (title/due/amount/status) live in indexed columns; the rest
 * in the JSON `data` column.
 */
export type FieldType = "text" | "textarea" | "money" | "date" | "datetime" | "number" | "select" | "bool" | "url" | "user";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
  promote?: "title" | "due_at" | "amount_cents";
  hint?: string;
};

export const RECURRENCE = ["none", "weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;
export type Recurrence = (typeof RECURRENCE)[number];

export type KindDef = {
  kind: string;
  label: string;
  plural: string;
  module: "planner" | "maintenance" | "packages";
  defaultVisibility: "shared" | "private";
  fields: Field[];
  /** Status values in lifecycle order; first is the default. */
  statuses: readonly string[];
  doneStatus?: string;
  dueLabel?: string;
};

const title = (label = "Name", placeholder?: string): Field => ({ name: "title", label, type: "text", required: true, promote: "title", placeholder });
const due = (label: string, type: "date" | "datetime" = "date", required = false): Field => ({ name: "due_at", label, type, promote: "due_at", required });
const money = (label = "Amount", required = true): Field => ({ name: "amount", label, type: "money", promote: "amount_cents", required });
const recurrence: Field = { name: "recurrence", label: "Repeats", type: "select", options: RECURRENCE };
const notes: Field = { name: "notes", label: "Notes", type: "textarea" };
const assignee: Field = { name: "assignee", label: "Assigned to", type: "user" };


export const KINDS: Record<string, KindDef> = {
  // ── Planner ───────────────────────────────────────────────────────────
  event: {
    kind: "event", label: "Event", plural: "Events", module: "planner", defaultVisibility: "shared",
    fields: [title("Title"), due("Starts", "datetime", true), { name: "ends_at", label: "Ends", type: "datetime" },
      { name: "location", label: "Location", type: "text" }, recurrence, notes],
    statuses: ["scheduled", "cancelled"],
  },
  task: {
    kind: "task", label: "Task", plural: "Tasks", module: "planner", defaultVisibility: "shared",
    fields: [title("Task"), due("Due"), assignee, { name: "priority", label: "Priority", type: "select", options: ["normal", "high"] }, notes],
    statuses: ["open", "done"], doneStatus: "done", dueLabel: "Due",
  },
  grocery: {
    kind: "grocery", label: "Grocery item", plural: "Groceries", module: "planner", defaultVisibility: "shared",
    fields: [title("Item", "Oat milk"), { name: "quantity", label: "Quantity", type: "text", placeholder: "2" },
      { name: "aisle", label: "Section", type: "select", options: ["Produce", "Bakery", "Dairy", "Meat & Fish", "Pantry", "Frozen", "Household", "Other"] }],
    statuses: ["open", "done"], doneStatus: "done",
  },
  recipe: {
    kind: "recipe", label: "Recipe", plural: "Recipes", module: "planner", defaultVisibility: "shared",
    fields: [title("Recipe"), { name: "minutes", label: "Total time (min)", type: "number" }, { name: "servings", label: "Servings", type: "number" },
      { name: "ingredients", label: "Ingredients", type: "textarea", hint: "One per line — can be sent to the grocery list." },
      { name: "steps", label: "Method", type: "textarea" }, { name: "url", label: "Source", type: "url" }],
    statuses: ["saved"],
  },
  meal: {
    kind: "meal", label: "Meal", plural: "Meal plan", module: "planner", defaultVisibility: "shared",
    fields: [title("Meal"), due("Day", "date", true), { name: "slot", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] }, notes],
    statuses: ["planned"],
  },
  chore: {
    kind: "chore", label: "Chore", plural: "Chores", module: "planner", defaultVisibility: "shared",
    fields: [title("Chore"), due("Next due", "date", true), assignee, { ...recurrence, required: true }],
    statuses: ["open", "done"], doneStatus: "done", dueLabel: "Due",
  },
  errand: {
    kind: "errand", label: "Errand", plural: "Errands", module: "planner", defaultVisibility: "shared",
    fields: [title("Errand"), { name: "location", label: "Where", type: "text" }, due("By"), assignee],
    statuses: ["open", "done"], doneStatus: "done",
  },
  occasion: {
    kind: "occasion", label: "Occasion", plural: "Birthdays & anniversaries", module: "planner", defaultVisibility: "shared",
    fields: [title("Whose / what"), due("Date", "date", true), { name: "type", label: "Type", type: "select", options: ["Birthday", "Anniversary", "Other"] },
      { name: "remind_days", label: "Remind days before", type: "number" }, notes],
    statuses: ["active"], dueLabel: "On",
  },
  note: {
    kind: "note", label: "Note", plural: "Notes", module: "planner", defaultVisibility: "shared",
    fields: [title("Title"), { name: "body", label: "Note", type: "textarea" }],
    statuses: ["active"],
  },
  goal: {
    kind: "goal", label: "Household goal", plural: "Goals", module: "planner", defaultVisibility: "shared",
    fields: [title("Goal"), { name: "progress", label: "Progress (%)", type: "number" }, due("Target date"), notes],
    statuses: ["active", "achieved"], doneStatus: "achieved",
  },
  // ── Maintenance ───────────────────────────────────────────────────────
  appliance: {
    kind: "appliance", label: "Appliance", plural: "Appliances", module: "maintenance", defaultVisibility: "shared",
    fields: [title("Appliance", "Dishwasher"), { name: "brand", label: "Brand", type: "text" }, { name: "model", label: "Model", type: "text" },
      { name: "serial", label: "Serial number", type: "text" }, { name: "location", label: "Room", type: "text" },
      { name: "purchased", label: "Purchased", type: "date" }, due("Warranty ends"), { name: "manual_url", label: "Manual", type: "url" }, notes],
    statuses: ["in_service", "retired"], dueLabel: "Warranty",
  },
  maintenance: {
    kind: "maintenance", label: "Maintenance task", plural: "Maintenance schedule", module: "maintenance", defaultVisibility: "shared",
    fields: [title("Task", "Replace HVAC filter"), due("Next due", "date", true), { ...recurrence, required: true },
      { name: "asset", label: "For", type: "text", placeholder: "Furnace" }, notes],
    statuses: ["open", "done"], doneStatus: "done", dueLabel: "Due",
  },
  vehicle: {
    kind: "vehicle", label: "Vehicle", plural: "Vehicles", module: "maintenance", defaultVisibility: "shared",
    fields: [title("Vehicle"), { name: "year", label: "Year", type: "number" }, { name: "plate", label: "Plate", type: "text" },
      { name: "vin", label: "VIN", type: "text" }, { name: "mileage", label: "Mileage", type: "number" },
      due("Registration / inspection due"), notes],
    statuses: ["active", "sold"], dueLabel: "Registration",
  },
  repair: {
    kind: "repair", label: "Repair", plural: "Repair history", module: "maintenance", defaultVisibility: "shared",
    fields: [title("What was fixed"), due("Date", "date", true), money("Cost", false), { name: "vendor", label: "Who did it", type: "text" }, notes],
    statuses: ["done"],
  },
  consumable: {
    kind: "consumable", label: "Consumable", plural: "Consumables", module: "maintenance", defaultVisibility: "shared",
    fields: [title("Item", "Water filter"), { name: "stock", label: "In stock", type: "number", required: true },
      { name: "reorder_at", label: "Reorder when at or below", type: "number" }, { name: "where", label: "Where to buy", type: "url" }],
    statuses: ["active"],
  },
  // ── Packages ─────────────────────────────────────────────────────────
  package: {
    kind: "package", label: "Package", plural: "Packages", module: "packages", defaultVisibility: "shared",
    fields: [title("What is it", "New headphones"), { name: "carrier", label: "Carrier", type: "select", options: ["UPS", "USPS", "FedEx", "DHL", "Amazon", "Other"] },
      { name: "tracking", label: "Tracking number", type: "text" }, due("Expected"), { name: "merchant", label: "From", type: "text" }, notes],
    statuses: ["ordered", "in_transit", "out_for_delivery", "delivered", "issue"], doneStatus: "delivered", dueLabel: "Expected",
  },
};

export function kindDef(kind: string): KindDef {
  const k = KINDS[kind];
  if (!k) throw new Error(`Unknown kind: ${kind}`);
  return k;
}

export function kindsFor(module: KindDef["module"]): KindDef[] {
  return Object.values(KINDS).filter((k) => k.module === module);
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
