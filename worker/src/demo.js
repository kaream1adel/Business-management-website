// Sample data for "See demo" (the DEMO_DB database, account 'owner'). Everything here is made
// up. Dates are relative to the day of the reset, so the demo always has
// something overdue, something today and a busy week ahead.

const BUSINESSES = [
  ['bottling', 'Bottling Plant',      '#2f5d8a', 1],
  ['workshop', 'Metal Workshop',      '#8a5a3c', 2],
  ['trading',  'Distribution Office', '#5a7d3a', 3],
];

// [business, name, status, priority, responsible, system, planned (days from today), deadline, notes, blocking issue]
const TASKS = [
  // Bottling Plant
  ['bottling', 'Calibrate filler valves before the night shift', 'In Progress', 'High', 'Omar', 'Filling', 0, 1, 'Use the new torque spec sheet.', ''],
  ['bottling', 'Replace worn conveyor belt on line 2', 'Not Started', 'High', 'Hassan', 'Conveyors', -2, -1, '', ''],
  ['bottling', 'Chiller: check refrigerant pressure', 'Blocked', 'High', 'Youssef', 'Chilling', -1, 2, '', 'Waiting for the service engineer to confirm a visit date'],
  ['bottling', 'CO2 tank inspection and certificate', 'Not Started', 'Medium', 'Youssef', 'CO2 plant', 3, 10, 'Certificate expires end of month.', ''],
  ['bottling', 'Train two new operators on the seamer', 'In Progress', 'Medium', 'Omar', 'Seaming', 1, null, '', ''],
  ['bottling', 'تنظيف خزان الشراب وتعقيمه', 'Not Started', 'Medium', 'مصطفى', 'Syrup room', 2, null, '', ''],
  ['bottling', 'Order spare O-rings for the filler', 'Done', 'Low', 'Hassan', 'Filling', -6, null, '', ''],
  ['bottling', 'Write the weekly downtime report', 'Not Started', 'Low', 'Sara', 'Reporting', 5, 5, '', ''],
  ['bottling', 'Install the new label sensor', 'Done', 'Medium', 'Hassan', 'Labelling', -3, null, '', ''],
  ['bottling', 'PLC backup after program changes', 'Not Started', 'High', 'Karim', 'Controls', 0, null, 'Save to the shared drive and USB.', ''],
  ['bottling', 'Fix air leak at the capper', 'In Progress', 'Medium', 'Omar', 'Compressed air', -1, null, '', ''],
  ['bottling', 'Monthly water quality test', 'Not Started', 'Medium', 'Sara', 'Water treatment', 6, 8, '', ''],
  ['bottling', 'Repaint safety lines on the floor', 'Not Started', 'Low', '', 'Building', null, null, '', ''],
  ['bottling', 'Quote for a second packing machine', 'Not Started', 'Low', 'Sara', 'Packing', null, 20, '', ''],
  ['bottling', 'شراء قطع غيار للكمبروسر', 'Done', 'High', 'مصطفى', 'Compressed air', -9, null, '', ''],
  ['bottling', 'Lubrication round, all gearboxes', 'Done', 'Medium', 'Hassan', 'Maintenance', -2, null, '', ''],

  // Metal Workshop
  ['workshop', 'Cut and bend panels for order #214', 'In Progress', 'High', 'Ali', 'Production', 0, 2, '40 panels, 1.5 mm galvanised.', ''],
  ['workshop', 'Service the press brake hydraulics', 'Not Started', 'High', 'Mahmoud', 'Press brake', -3, -1, '', ''],
  ['workshop', 'Hire a second welder', 'Blocked', 'Medium', 'Nour', 'HR', -5, 7, '', 'Two candidates, waiting for references'],
  ['workshop', 'Laser cutter lens replacement', 'Not Started', 'Medium', 'Mahmoud', 'Laser', 2, null, '', ''],
  ['workshop', 'Deliver ducting to the Nasr site', 'Not Started', 'High', 'Ali', 'Delivery', 1, 1, 'Truck booked for 8 am.', ''],
  ['workshop', 'تسعير طلبية الأبواب المعدنية', 'In Progress', 'Medium', 'نور', 'Sales', 0, 3, '', ''],
  ['workshop', 'Stock count of sheet metal', 'Not Started', 'Low', 'Nour', 'Inventory', 4, null, '', ''],
  ['workshop', 'Fix the extraction fan', 'Done', 'Medium', 'Mahmoud', 'Building', -4, null, '', ''],
  ['workshop', 'Powder coating trial with the new supplier', 'Not Started', 'Low', 'Ali', 'Finishing', 9, null, '', ''],
  ['workshop', 'Order #209 quality check', 'Done', 'High', 'Nour', 'Quality', -1, null, '', ''],
  ['workshop', 'Safety training: grinders and PPE', 'Not Started', 'Medium', 'Nour', 'Safety', 3, null, '', ''],
  ['workshop', 'Rack layout for the finished goods area', 'Not Started', 'Low', '', 'Building', null, null, '', ''],

  // Distribution Office
  ['trading', 'Chase overdue invoices from three customers', 'In Progress', 'High', 'Mona', 'Finance', -1, 0, '', ''],
  ['trading', 'Confirm next month price list', 'Not Started', 'High', 'Tarek', 'Sales', 0, 2, '', ''],
  ['trading', 'Container from the port: customs papers', 'Blocked', 'High', 'Tarek', 'Imports', -2, 1, '', 'Broker needs the original certificate of origin'],
  ['trading', 'Update stock levels in the warehouse sheet', 'Not Started', 'Medium', 'Mona', 'Inventory', 1, null, '', ''],
  ['trading', 'WhatsApp catalogue: add 12 new items', 'Not Started', 'Low', 'Mona', 'Marketing', 4, null, '', ''],
  ['trading', 'متابعة طلبية العميل الجديد في الإسكندرية', 'Not Started', 'Medium', 'طارق', 'Sales', 2, 5, '', ''],
  ['trading', 'Quarterly VAT filing', 'Not Started', 'High', 'Mona', 'Finance', 7, 10, '', ''],
  ['trading', 'Visit two new retail customers', 'Done', 'Medium', 'Tarek', 'Sales', -5, null, '', ''],
  ['trading', 'Renew the warehouse lease', 'Done', 'High', 'Mona', 'Admin', -12, null, '', ''],
  ['trading', 'Pick a delivery partner for the delta region', 'Not Started', 'Medium', 'Tarek', 'Logistics', null, 14, '', ''],
  ['trading', 'Set up a returns process', 'Not Started', 'Low', '', 'Operations', null, null, '', ''],
];

const day = (offset) => {
  if (offset === null || offset === undefined) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Wipes the demo database and loads the sample data again.
export async function resetDemo(env) {
  const now = new Date().toISOString();
  const stmts = [
    env.DB.prepare('DELETE FROM activity_log'),
    env.DB.prepare('DELETE FROM tasks'),
    env.DB.prepare('DELETE FROM businesses'),
    env.DB.prepare('DELETE FROM login_attempts'),
  ];
  for (const [id, name, color, order] of BUSINESSES) {
    stmts.push(env.DB.prepare(
      "INSERT INTO businesses (id, user_id, name, color, sort_order, version, archived_at, created_at) VALUES (?, 'owner', ?, ?, ?, 1, NULL, ?)"
    ).bind(id, name, color, order, now));
  }
  TASKS.forEach(([biz, name, status, priority, who, system, planned, deadline, notes, blocking], i) => {
    const id = crypto.randomUUID();
    // Finished tasks were completed on their planned day; others were created over the last weeks
    const done = status === 'Done' ? `${day(planned ?? -1)}T15:00:00.000Z` : null;
    const created = `${day(-20 + (i % 15))}T08:00:00.000Z`;
    const row = {
      biz_id: biz, task_name: name, status, priority, responsible: who, system,
      planned_date: day(planned), deadline: day(deadline), notes, blocking_issue: blocking,
    };
    stmts.push(env.DB.prepare(
      `INSERT INTO tasks (id, user_id, biz_id, task_name, status, priority, responsible, system, planned_date, deadline,
         notes, blocking_issue, extra, version, created_at, updated_at, completed_at)
       VALUES (?, 'owner', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?)`
    ).bind(id, biz, name, status, priority, who, system, row.planned_date, row.deadline, notes, blocking,
      created, done || created, done));
    stmts.push(env.DB.prepare(
      `INSERT INTO activity_log (task_id, action, version, changes, at) VALUES (?, 'create', 1, ?, ?)`
    ).bind(id, JSON.stringify(row), created));
  });
  await env.DB.batch(stmts);
}

// True until the sample data has been loaded (a fresh database only has the
// three businesses from the first migration).
export async function demoIsEmpty(env) {
  const row = await env.DB.prepare('SELECT 1 AS ok FROM businesses WHERE id = ?').bind(BUSINESSES[0][0]).first();
  return !row;
}
