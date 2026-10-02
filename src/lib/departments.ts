/**
 * Department registry — the single source of truth for the Operations and
 * Marketing departments.
 *
 * One declarative config drives all three layers, so a new department page is
 * added in exactly one place:
 *
 *   • Prisma        -> `model` points at the tenant-scoped table
 *   • API           -> `src/lib/department-api.ts` builds CRUD handlers from `fields`
 *   • Dashboard UI  -> `DepartmentWorkspace.tsx` renders table, filters, KPIs & forms
 *   • Permissions   -> `src/lib/permissions.ts` re-exports these pages into the
 *                      sidebar + permission matrix (RBAC is enforced on both sides)
 *
 * This module is imported by both client and server code, so it must stay free
 * of any server-only import (no prisma, no node builtins).
 */

export type DepartmentKey = 'operations' | 'marketing';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'tel'
  | 'email';

export interface DepartmentFieldDef {
  /** Prisma column name — also the key used in API payloads. */
  key: string;
  label: string;
  type: FieldType;
  /** Required on create/update (ignored for auto-generated code fields). */
  required?: boolean;
  /** Allowed values for `select` fields — validated server-side too. */
  options?: string[];
  placeholder?: string;
  hint?: string;
  /** Default applied when the client sends nothing. */
  defaultValue?: string | number;
  /** Show this field as a table column. */
  column?: boolean;
  /** Render the column as a coloured status pill. */
  badge?: boolean;
  /** Include in the free-text search (client + server). */
  searchable?: boolean;
  /** Server-generated, read-only in the UI (e.g. AST-1001). */
  generated?: boolean;
  /** Full-width in the modal form grid. */
  wide?: boolean;
  /** Integer bounds for `number` fields. */
  min?: number;
  max?: number;
}

export type MetricKind = 'count' | 'sum' | 'sumProduct' | 'countWhere' | 'rate';

export interface DepartmentMetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  /** Field to aggregate (`sum`, `countWhere`, `rate`). */
  field?: string;
  /** Two fields multiplied per row (`sumProduct`). */
  fields?: [string, string];
  /** Values that satisfy `countWhere` / `rate`. */
  match?: string[];
  /** Format the value as tenant currency. */
  money?: boolean;
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
  icon: string;
}

export interface DepartmentResourceDef {
  /** URL/segment key, e.g. `assets` -> /api/operations/assets */
  key: string;
  department: DepartmentKey;
  /** Dashboard `activeTab` value. */
  tab: string;
  /** Permission page key (see src/lib/permissions.ts). */
  permKey: string;
  /** Short sidebar label. */
  navLabel: string;
  /** Page heading. */
  title: string;
  description: string;
  icon: string;
  /** Prisma model accessor (camelCase), e.g. `workOrder`. */
  model: string;
  /** Singular noun used in buttons, toasts and confirmations. */
  singular: string;
  /** Human readable code column + prefix (auto-generated server-side). */
  codeField?: string;
  codePrefix?: string;
  /** Column used by the status filter dropdown. */
  statusField?: string;
  fields: DepartmentFieldDef[];
  metrics: DepartmentMetricDef[];
  emptyHint: string;
}

export interface DepartmentDef {
  key: DepartmentKey;
  label: string;
  navLabel: string;
  description: string;
  icon: string;
  resources: DepartmentResourceDef[];
}

/* -------------------------------------------------------------------------- */
/* Shared option lists                                                         */
/* -------------------------------------------------------------------------- */

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const SCHOOL_DEPARTMENTS = [
  'Academics',
  'Administration',
  'Finance',
  'ICT',
  'Kitchen',
  'Library',
  'Maintenance',
  'Sports',
  'Transport',
  'Other',
];

/* -------------------------------------------------------------------------- */
/* OPERATIONS                                                                  */
/* -------------------------------------------------------------------------- */

const ASSETS: DepartmentResourceDef = {
  key: 'assets',
  department: 'operations',
  tab: 'ops-assets',
  permKey: 'ops_assets',
  navLabel: 'Assets & Inventory',
  title: 'Assets & Inventory',
  description: 'Track every tangible item the school owns — furniture, ICT gear, lab equipment and stock.',
  icon: '📦',
  model: 'asset',
  singular: 'Asset',
  codeField: 'assetTag',
  codePrefix: 'AST',
  statusField: 'status',
  emptyHint: 'Start by tagging high-value items such as laptops, projectors, desks and generators.',
  fields: [
    { key: 'assetTag', label: 'Asset Tag', type: 'text', generated: true, column: true, searchable: true },
    { key: 'name', label: 'Asset Name', type: 'text', required: true, column: true, searchable: true, placeholder: 'e.g. HP ProBook Laptop' },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'Other',
      options: ['Furniture', 'ICT Equipment', 'Laboratory', 'Sports', 'Vehicle', 'Books & Library', 'Kitchen', 'Power & Utilities', 'Other'],
    },
    { key: 'quantity', label: 'Quantity', type: 'number', column: true, defaultValue: 1, min: 0, max: 1000000 },
    { key: 'unitCost', label: 'Unit Cost', type: 'money', column: true },
    { key: 'location', label: 'Location', type: 'text', column: true, searchable: true, placeholder: 'e.g. Science Block, Room 4' },
    {
      key: 'condition',
      label: 'Condition',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Good',
      options: ['New', 'Good', 'Fair', 'Needs Repair', 'Damaged', 'Disposed'],
    },
    { key: 'assignedTo', label: 'Assigned To', type: 'text', searchable: true, placeholder: 'Staff member or department' },
    { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'In Service',
      options: ['In Service', 'In Storage', 'Under Repair', 'Retired'],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true, placeholder: 'Serial numbers, warranty details, supplier...' },
  ],
  metrics: [
    { key: 'total', label: 'Asset Records', kind: 'count', tone: 'blue', icon: '📦' },
    { key: 'units', label: 'Total Units', kind: 'sum', field: 'quantity', tone: 'violet', icon: '🔢' },
    { key: 'value', label: 'Inventory Value', kind: 'sumProduct', fields: ['unitCost', 'quantity'], money: true, tone: 'emerald', icon: '💵' },
    { key: 'attention', label: 'Needs Attention', kind: 'countWhere', field: 'condition', match: ['Needs Repair', 'Damaged'], tone: 'rose', icon: '🛠️' },
  ],
};

const REQUISITIONS: DepartmentResourceDef = {
  key: 'requisitions',
  department: 'operations',
  tab: 'ops-requisitions',
  permKey: 'ops_requisitions',
  navLabel: 'Procurement',
  title: 'Procurement & Requisitions',
  description: 'Raise, approve and track purchase requests before money leaves the school account.',
  icon: '🧾',
  model: 'requisition',
  singular: 'Requisition',
  codeField: 'requisitionNumber',
  codePrefix: 'REQ',
  statusField: 'status',
  emptyHint: 'Log the first purchase request — stationery, exam sheets, lab reagents or repairs.',
  fields: [
    { key: 'requisitionNumber', label: 'Requisition No.', type: 'text', generated: true, column: true, searchable: true },
    { key: 'title', label: 'Request Title', type: 'text', required: true, column: true, searchable: true, placeholder: 'e.g. Term 2 exam stationery' },
    { key: 'department', label: 'Requesting Dept.', type: 'select', column: true, searchable: true, defaultValue: 'Administration', options: SCHOOL_DEPARTMENTS },
    { key: 'requestedBy', label: 'Requested By', type: 'text', column: true, searchable: true },
    { key: 'estimatedCost', label: 'Estimated Cost', type: 'money', column: true },
    { key: 'priority', label: 'Priority', type: 'select', column: true, badge: true, defaultValue: 'Medium', options: PRIORITIES },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Pending',
      options: ['Pending', 'Approved', 'Ordered', 'Received', 'Rejected'],
    },
    { key: 'neededBy', label: 'Needed By', type: 'date', column: true },
    { key: 'supplier', label: 'Preferred Vendor', type: 'text', searchable: true },
    { key: 'itemsSummary', label: 'Items Requested', type: 'textarea', wide: true, placeholder: '10 x reams A4 paper, 4 x toner cartridges...' },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'total', label: 'Requests', kind: 'count', tone: 'blue', icon: '🧾' },
    { key: 'pending', label: 'Awaiting Approval', kind: 'countWhere', field: 'status', match: ['Pending'], tone: 'amber', icon: '⏳' },
    { key: 'committed', label: 'Estimated Spend', kind: 'sum', field: 'estimatedCost', money: true, tone: 'emerald', icon: '💵' },
    { key: 'urgent', label: 'Urgent', kind: 'countWhere', field: 'priority', match: ['Urgent', 'High'], tone: 'rose', icon: '🚨' },
  ],
};

const WORK_ORDERS: DepartmentResourceDef = {
  key: 'work-orders',
  department: 'operations',
  tab: 'ops-work-orders',
  permKey: 'ops_work_orders',
  navLabel: 'Maintenance',
  title: 'Maintenance & Work Orders',
  description: 'Log faults reported around campus and follow them through to completion.',
  icon: '🛠️',
  model: 'workOrder',
  singular: 'Work Order',
  codeField: 'orderNumber',
  codePrefix: 'WO',
  statusField: 'status',
  emptyHint: 'Report the first job — a broken desk, a faulty socket or a leaking tap.',
  fields: [
    { key: 'orderNumber', label: 'Work Order No.', type: 'text', generated: true, column: true, searchable: true },
    { key: 'title', label: 'Job Title', type: 'text', required: true, column: true, searchable: true, placeholder: 'e.g. Replace broken window — Block B' },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'Other',
      options: ['Electrical', 'Plumbing', 'Carpentry', 'Painting', 'ICT', 'Grounds', 'Vehicle', 'Cleaning', 'Other'],
    },
    { key: 'location', label: 'Location', type: 'text', column: true, searchable: true },
    { key: 'priority', label: 'Priority', type: 'select', column: true, badge: true, defaultValue: 'Medium', options: PRIORITIES },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Open',
      options: ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    },
    { key: 'reportedBy', label: 'Reported By', type: 'text', searchable: true },
    { key: 'assignedTo', label: 'Assigned To', type: 'text', column: true, searchable: true, placeholder: 'Technician or contractor' },
    { key: 'reportedOn', label: 'Reported On', type: 'date' },
    { key: 'dueDate', label: 'Target Date', type: 'date', column: true },
    { key: 'cost', label: 'Repair Cost', type: 'money', column: true },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'open', label: 'Open Jobs', kind: 'countWhere', field: 'status', match: ['Open', 'In Progress'], tone: 'amber', icon: '🔧' },
    { key: 'critical', label: 'Urgent Jobs', kind: 'countWhere', field: 'priority', match: ['Urgent'], tone: 'rose', icon: '🚨' },
    { key: 'completed', label: 'Completed', kind: 'countWhere', field: 'status', match: ['Completed'], tone: 'emerald', icon: '✅' },
    { key: 'spend', label: 'Maintenance Spend', kind: 'sum', field: 'cost', money: true, tone: 'blue', icon: '💵' },
  ],
};

const TRANSPORT: DepartmentResourceDef = {
  key: 'transport',
  department: 'operations',
  tab: 'ops-transport',
  permKey: 'ops_transport',
  navLabel: 'Transport',
  title: 'Transport & Fleet',
  description: 'School bus routes, drivers, seat capacity and termly transport fares.',
  icon: '🚌',
  model: 'transportRoute',
  singular: 'Route',
  codeField: 'routeCode',
  codePrefix: 'RTE',
  statusField: 'status',
  emptyHint: 'Add the first route with its vehicle, driver and pickup points.',
  fields: [
    { key: 'routeCode', label: 'Route Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'routeName', label: 'Route Name', type: 'text', required: true, column: true, searchable: true, placeholder: 'e.g. Madina – Adenta Loop' },
    { key: 'vehicleNumber', label: 'Vehicle Number', type: 'text', column: true, searchable: true, placeholder: 'e.g. GT 4567-24' },
    { key: 'vehicleType', label: 'Vehicle Type', type: 'select', column: true, defaultValue: 'Bus', options: ['Bus', 'Mini Bus', 'Van', 'Car', 'Motorbike'] },
    { key: 'driverName', label: 'Driver', type: 'text', column: true, searchable: true },
    { key: 'driverPhone', label: 'Driver Phone', type: 'tel', column: true },
    { key: 'capacity', label: 'Seat Capacity', type: 'number', column: true, min: 0, max: 200 },
    { key: 'studentsAssigned', label: 'Students Assigned', type: 'number', column: true, min: 0, max: 200 },
    { key: 'fare', label: 'Fare / Term', type: 'money', column: true },
    { key: 'status', label: 'Status', type: 'select', column: true, badge: true, defaultValue: 'Active', options: ['Active', 'Inactive', 'Under Maintenance'] },
    { key: 'pickupPoints', label: 'Pickup Points', type: 'textarea', wide: true, placeholder: 'Madina Zongo Junction, Redco Flats, Adenta Barrier...' },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'routes', label: 'Active Routes', kind: 'countWhere', field: 'status', match: ['Active'], tone: 'blue', icon: '🚌' },
    { key: 'capacity', label: 'Fleet Capacity', kind: 'sum', field: 'capacity', tone: 'violet', icon: '💺' },
    { key: 'riders', label: 'Students Ferried', kind: 'sum', field: 'studentsAssigned', tone: 'emerald', icon: '🎒' },
    { key: 'revenue', label: 'Termly Fare Value', kind: 'sumProduct', fields: ['fare', 'studentsAssigned'], money: true, tone: 'amber', icon: '💵' },
  ],
};

const VENDORS: DepartmentResourceDef = {
  key: 'vendors',
  department: 'operations',
  tab: 'ops-vendors',
  permKey: 'ops_vendors',
  navLabel: 'Vendors',
  title: 'Vendors & Suppliers',
  description: 'Approved suppliers, their contacts and the payment terms agreed with the school.',
  icon: '🏪',
  model: 'vendor',
  singular: 'Vendor',
  codeField: 'vendorCode',
  codePrefix: 'VND',
  statusField: 'status',
  emptyHint: 'Add the suppliers you buy from regularly so requisitions can reference them.',
  fields: [
    { key: 'vendorCode', label: 'Vendor Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'name', label: 'Vendor Name', type: 'text', required: true, column: true, searchable: true },
    {
      key: 'category',
      label: 'Supplies',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'Other',
      options: ['Stationery', 'Food & Catering', 'ICT', 'Furniture', 'Maintenance', 'Transport', 'Uniforms', 'Books', 'Utilities', 'Other'],
    },
    { key: 'contactPerson', label: 'Contact Person', type: 'text', column: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'tel', column: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', column: true, searchable: true },
    { key: 'address', label: 'Address', type: 'text', wide: true },
    {
      key: 'paymentTerms',
      label: 'Payment Terms',
      type: 'select',
      column: true,
      defaultValue: 'Cash on Delivery',
      options: ['Cash on Delivery', 'Prepaid', 'Net 7 Days', 'Net 14 Days', 'Net 30 Days'],
    },
    { key: 'status', label: 'Status', type: 'select', column: true, badge: true, defaultValue: 'Active', options: ['Active', 'Inactive', 'Blacklisted'] },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'total', label: 'Vendors', kind: 'count', tone: 'blue', icon: '🏪' },
    { key: 'active', label: 'Active', kind: 'countWhere', field: 'status', match: ['Active'], tone: 'emerald', icon: '✅' },
    { key: 'credit', label: 'On Credit Terms', kind: 'countWhere', field: 'paymentTerms', match: ['Net 7 Days', 'Net 14 Days', 'Net 30 Days'], tone: 'violet', icon: '📄' },
    { key: 'blocked', label: 'Blacklisted', kind: 'countWhere', field: 'status', match: ['Blacklisted'], tone: 'rose', icon: '⛔' },
  ],
};

/* -------------------------------------------------------------------------- */
/* MARKETING                                                                   */
/* -------------------------------------------------------------------------- */

const CAMPAIGNS: DepartmentResourceDef = {
  key: 'campaigns',
  department: 'marketing',
  tab: 'mkt-campaigns',
  permKey: 'mkt_campaigns',
  navLabel: 'Campaigns',
  title: 'Marketing Campaigns',
  description: 'Plan admissions drives across SMS, radio and social media — and track what each one costs.',
  icon: '📣',
  model: 'campaign',
  singular: 'Campaign',
  codeField: 'campaignCode',
  codePrefix: 'CMP',
  statusField: 'status',
  emptyHint: 'Create your first campaign, e.g. “September Intake – Radio & SMS blast”.',
  fields: [
    { key: 'campaignCode', label: 'Campaign Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'name', label: 'Campaign Name', type: 'text', required: true, column: true, searchable: true },
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'SMS',
      options: ['SMS', 'Email', 'Radio', 'Social Media', 'Flyers', 'Billboard', 'Community Outreach', 'Field Visit', 'Referral'],
    },
    {
      key: 'objective',
      label: 'Objective',
      type: 'select',
      column: true,
      defaultValue: 'Admissions Drive',
      options: ['Admissions Drive', 'Brand Awareness', 'Re-enrollment', 'Event Promotion', 'Fundraising'],
    },
    { key: 'audience', label: 'Target Audience', type: 'text', searchable: true, placeholder: 'e.g. Parents within 10km of campus' },
    { key: 'budget', label: 'Budget', type: 'money', column: true },
    { key: 'spend', label: 'Amount Spent', type: 'money', column: true },
    { key: 'startDate', label: 'Start Date', type: 'date', column: true },
    { key: 'endDate', label: 'End Date', type: 'date', column: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Draft',
      options: ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed'],
    },
    { key: 'leadsGenerated', label: 'Leads Generated', type: 'number', column: true, min: 0, max: 1000000 },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'active', label: 'Running Now', kind: 'countWhere', field: 'status', match: ['Active'], tone: 'emerald', icon: '📣' },
    { key: 'budget', label: 'Total Budget', kind: 'sum', field: 'budget', money: true, tone: 'blue', icon: '💰' },
    { key: 'spend', label: 'Total Spend', kind: 'sum', field: 'spend', money: true, tone: 'amber', icon: '💸' },
    { key: 'leads', label: 'Leads Generated', kind: 'sum', field: 'leadsGenerated', tone: 'violet', icon: '🎯' },
  ],
};

const LEADS: DepartmentResourceDef = {
  key: 'leads',
  department: 'marketing',
  tab: 'mkt-leads',
  permKey: 'mkt_leads',
  navLabel: 'Leads & Enquiries',
  title: 'Leads & Admission Enquiries',
  description: 'Every prospective parent who calls, walks in or fills a form — followed up to enrollment.',
  icon: '🎯',
  model: 'lead',
  singular: 'Lead',
  codeField: 'leadCode',
  codePrefix: 'LED',
  statusField: 'stage',
  emptyHint: 'Capture walk-in and phone enquiries here so none of them goes cold.',
  fields: [
    { key: 'leadCode', label: 'Lead Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'parentName', label: 'Parent / Guardian', type: 'text', required: true, column: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'tel', required: true, column: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', searchable: true },
    { key: 'studentName', label: 'Prospective Student', type: 'text', column: true, searchable: true },
    { key: 'interestedClass', label: 'Class of Interest', type: 'text', column: true, searchable: true, placeholder: 'e.g. Basic 3' },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'Walk-in',
      options: ['Walk-in', 'Phone Call', 'Website', 'Social Media', 'Referral', 'Campaign', 'Event', 'Other'],
    },
    {
      key: 'stage',
      label: 'Stage',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'New',
      options: ['New', 'Contacted', 'Toured', 'Applied', 'Enrolled', 'Lost'],
    },
    { key: 'assignedTo', label: 'Owner', type: 'text', column: true, searchable: true, placeholder: 'Staff following up' },
    { key: 'nextFollowUp', label: 'Next Follow-up', type: 'date', column: true },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true, placeholder: 'What did the parent ask for?' },
  ],
  metrics: [
    { key: 'total', label: 'Total Leads', kind: 'count', tone: 'blue', icon: '🎯' },
    { key: 'open', label: 'In Pipeline', kind: 'countWhere', field: 'stage', match: ['New', 'Contacted', 'Toured', 'Applied'], tone: 'amber', icon: '🔥' },
    { key: 'enrolled', label: 'Enrolled', kind: 'countWhere', field: 'stage', match: ['Enrolled'], tone: 'emerald', icon: '🎓' },
    { key: 'conversion', label: 'Conversion Rate', kind: 'rate', field: 'stage', match: ['Enrolled'], tone: 'violet', icon: '📈' },
  ],
};

const ANNOUNCEMENTS: DepartmentResourceDef = {
  key: 'announcements',
  department: 'marketing',
  tab: 'mkt-announcements',
  permKey: 'mkt_announcements',
  navLabel: 'Announcements',
  title: 'Announcements & Broadcasts',
  description: 'Draft, schedule and publish messages to parents, staff and the wider community.',
  icon: '📢',
  model: 'announcement',
  singular: 'Announcement',
  codeField: 'announcementCode',
  codePrefix: 'ANN',
  statusField: 'status',
  emptyHint: 'Draft a notice — reopening dates, PTA meetings or fee deadlines.',
  fields: [
    { key: 'announcementCode', label: 'Ref.', type: 'text', generated: true, column: true, searchable: true },
    { key: 'title', label: 'Title', type: 'text', required: true, column: true, searchable: true },
    {
      key: 'audience',
      label: 'Audience',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'All Parents',
      options: ['All Parents', 'All Staff', 'Students', 'Prospective Parents', 'Specific Class', 'Public'],
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      column: true,
      defaultValue: 'SMS',
      options: ['SMS', 'Email', 'Notice Board', 'Website', 'Social Media', 'Assembly'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Draft',
      options: ['Draft', 'Scheduled', 'Published', 'Archived'],
    },
    { key: 'publishAt', label: 'Publish On', type: 'date', column: true },
    { key: 'publishedBy', label: 'Published By', type: 'text', column: true, searchable: true },
    { key: 'body', label: 'Message', type: 'textarea', required: true, wide: true, searchable: true, placeholder: 'Dear parents, school reopens on...' },
  ],
  metrics: [
    { key: 'total', label: 'Notices', kind: 'count', tone: 'blue', icon: '📢' },
    { key: 'published', label: 'Published', kind: 'countWhere', field: 'status', match: ['Published'], tone: 'emerald', icon: '✅' },
    { key: 'scheduled', label: 'Scheduled', kind: 'countWhere', field: 'status', match: ['Scheduled'], tone: 'amber', icon: '⏰' },
    { key: 'drafts', label: 'Drafts', kind: 'countWhere', field: 'status', match: ['Draft'], tone: 'slate', icon: '📝' },
  ],
};

const EVENTS: DepartmentResourceDef = {
  key: 'events',
  department: 'marketing',
  tab: 'mkt-events',
  permKey: 'mkt_events',
  navLabel: 'Events & Open Days',
  title: 'Events & Open Days',
  description: 'Open days, orientations and outreach — with budgets and turnout tracked against each one.',
  icon: '🎪',
  model: 'marketingEvent',
  singular: 'Event',
  codeField: 'eventCode',
  codePrefix: 'EVT',
  statusField: 'status',
  emptyHint: 'Plan an open day or orientation and track how many families actually show up.',
  fields: [
    { key: 'eventCode', label: 'Event Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'name', label: 'Event Name', type: 'text', required: true, column: true, searchable: true },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      column: true,
      searchable: true,
      defaultValue: 'Open Day',
      options: ['Open Day', 'Orientation', 'Speech & Prize Day', 'PTA Meeting', 'Sports Day', 'Exhibition', 'Community Outreach', 'Other'],
    },
    { key: 'venue', label: 'Venue', type: 'text', column: true, searchable: true },
    { key: 'startDate', label: 'Start Date', type: 'date', column: true },
    { key: 'endDate', label: 'End Date', type: 'date' },
    { key: 'owner', label: 'Coordinator', type: 'text', column: true, searchable: true },
    { key: 'expectedAttendees', label: 'Expected Turnout', type: 'number', column: true, min: 0, max: 1000000 },
    { key: 'actualAttendees', label: 'Actual Turnout', type: 'number', column: true, min: 0, max: 1000000 },
    { key: 'budget', label: 'Budget', type: 'money', column: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Planned',
      options: ['Planned', 'Confirmed', 'Ongoing', 'Completed', 'Cancelled'],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'upcoming', label: 'Upcoming', kind: 'countWhere', field: 'status', match: ['Planned', 'Confirmed'], tone: 'blue', icon: '🗓️' },
    { key: 'completed', label: 'Completed', kind: 'countWhere', field: 'status', match: ['Completed'], tone: 'emerald', icon: '✅' },
    { key: 'turnout', label: 'Total Turnout', kind: 'sum', field: 'actualAttendees', tone: 'violet', icon: '👪' },
    { key: 'budget', label: 'Events Budget', kind: 'sum', field: 'budget', money: true, tone: 'amber', icon: '💰' },
  ],
};

const REFERRALS: DepartmentResourceDef = {
  key: 'referrals',
  department: 'marketing',
  tab: 'mkt-referrals',
  permKey: 'mkt_referrals',
  navLabel: 'Referrals',
  title: 'Referral Programme',
  description: 'Word of mouth is the cheapest admissions channel — track who referred whom and the reward owed.',
  icon: '🤝',
  model: 'referral',
  singular: 'Referral',
  codeField: 'referralCode',
  codePrefix: 'REF',
  statusField: 'status',
  emptyHint: 'Record referrals from parents, staff and alumni, plus the reward promised.',
  fields: [
    { key: 'referralCode', label: 'Ref. Code', type: 'text', generated: true, column: true, searchable: true },
    { key: 'referrerName', label: 'Referred By', type: 'text', required: true, column: true, searchable: true },
    { key: 'referrerType', label: 'Referrer Type', type: 'select', column: true, defaultValue: 'Parent', options: ['Parent', 'Staff', 'Student', 'Alumni', 'Partner'] },
    { key: 'referrerPhone', label: 'Referrer Phone', type: 'tel', column: true, searchable: true },
    { key: 'prospectName', label: 'Prospect', type: 'text', required: true, column: true, searchable: true },
    { key: 'prospectClass', label: 'Prospect Class', type: 'text', column: true, searchable: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      column: true,
      badge: true,
      defaultValue: 'Pending',
      options: ['Pending', 'Contacted', 'Enrolled', 'Declined'],
    },
    { key: 'rewardType', label: 'Reward', type: 'select', column: true, defaultValue: 'None', options: ['None', 'Fee Discount', 'Cash', 'Gift Item', 'Airtime'] },
    { key: 'rewardAmount', label: 'Reward Value', type: 'money', column: true },
    { key: 'rewardStatus', label: 'Reward Status', type: 'select', column: true, badge: true, defaultValue: 'Not Due', options: ['Not Due', 'Pending', 'Paid'] },
    { key: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ],
  metrics: [
    { key: 'total', label: 'Referrals', kind: 'count', tone: 'blue', icon: '🤝' },
    { key: 'enrolled', label: 'Converted', kind: 'countWhere', field: 'status', match: ['Enrolled'], tone: 'emerald', icon: '🎓' },
    { key: 'conversion', label: 'Conversion Rate', kind: 'rate', field: 'status', match: ['Enrolled'], tone: 'violet', icon: '📈' },
    { key: 'rewards', label: 'Rewards Owed', kind: 'sum', field: 'rewardAmount', money: true, tone: 'amber', icon: '🎁' },
  ],
};

/* -------------------------------------------------------------------------- */
/* Registry + helpers                                                          */
/* -------------------------------------------------------------------------- */

export const DEPARTMENTS: DepartmentDef[] = [
  {
    key: 'operations',
    label: 'Operations',
    navLabel: 'OPERATIONS',
    description: 'Assets, procurement, maintenance, transport & suppliers',
    icon: '🏗️',
    resources: [ASSETS, REQUISITIONS, WORK_ORDERS, TRANSPORT, VENDORS],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    navLabel: 'MARKETING',
    description: 'Campaigns, admission leads, announcements, events & referrals',
    icon: '📣',
    resources: [CAMPAIGNS, LEADS, ANNOUNCEMENTS, EVENTS, REFERRALS],
  },
];

export const DEPARTMENT_RESOURCES: DepartmentResourceDef[] = DEPARTMENTS.flatMap((d) => d.resources);

export function getDepartment(key: string): DepartmentDef | undefined {
  return DEPARTMENTS.find((d) => d.key === key);
}

/** Look up a resource by its API segment within a department. */
export function getDepartmentResource(department: string, resource: string): DepartmentResourceDef | undefined {
  return getDepartment(department)?.resources.find((r) => r.key === resource);
}

/** Look up a resource by the dashboard tab it renders. */
export function getResourceByTab(tab: string): DepartmentResourceDef | undefined {
  return DEPARTMENT_RESOURCES.find((r) => r.tab === tab);
}

export function departmentApiPath(resource: DepartmentResourceDef): string {
  return `/api/${resource.department}/${resource.key}`;
}

/** Fields that participate in free-text search. */
export function searchableFields(resource: DepartmentResourceDef): DepartmentFieldDef[] {
  return resource.fields.filter((f) => f.searchable);
}

/** Distinct status values offered by the status filter. */
export function statusOptions(resource: DepartmentResourceDef): string[] {
  if (!resource.statusField) return [];
  return resource.fields.find((f) => f.key === resource.statusField)?.options ?? [];
}

/**
 * Tone for a status pill. Keyword based so every resource gets sensible
 * colours without hand-maintaining a map per status value.
 */
export function statusTone(value: string | null | undefined): 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' {
  const v = String(value ?? '').toLowerCase();
  if (!v) return 'slate';
  if (['active', 'approved', 'completed', 'received', 'published', 'enrolled', 'paid', 'new', 'good', 'in service', 'confirmed'].includes(v)) {
    return 'emerald';
  }
  if (['pending', 'scheduled', 'on hold', 'draft', 'planned', 'medium', 'fair', 'in storage', 'not due', 'paused'].includes(v)) {
    return 'amber';
  }
  if (['rejected', 'cancelled', 'lost', 'declined', 'blacklisted', 'damaged', 'urgent', 'critical', 'needs repair', 'retired', 'disposed'].includes(v)) {
    return 'rose';
  }
  if (['in progress', 'contacted', 'toured', 'applied', 'ordered', 'ongoing', 'open', 'high', 'under repair', 'under maintenance'].includes(v)) {
    return 'blue';
  }
  return 'slate';
}
