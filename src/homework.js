const STATUS_MAP = {
  "已完成": "Completed",
  "已批阅": "Completed",
  "未提交": "Pending",
  "未交": "Pending",
  "待批阅": "Completed",
  "已提交": "Pending",
  "已截止": "Overdue",
};

function canonicalStatus(label) {
  return STATUS_MAP[label] || "Unknown";
}

function parseHomeworkHtml(html) {
  if (!html) return [];

  const liRegex = /<li\b[^>]*goTask[^>]*>(.*?)<\/li>/gs;
  const items = [];

  for (const match of html.matchAll(liRegex)) {
    const full = match[0];
    const inner = match[1];

    const dataUrl = (full.match(/data\s*=\s*"([^"]*)"/) || [])[1] || "";

    const courseId = Number((dataUrl.match(/courseId=(\d+)/) || [])[1]) || 0;

    const classId = Number((dataUrl.match(/clazzId=(\d+)/) || [])[1]) || 0;

    const title = (inner.match(/<p\b[^>]*>([^<]*)<\/p>/) || [])[1] || "";

    const statusSpan = (inner.match(/<p\b[^>]*>.*?<\/p>\s*<span[^>]*>([^《<]*)<\/span>/) || [])[1] || "";

    const course = (inner.match(/《([^》]*)》/) || [])[1] || "";

    const deadline = (inner.match(/<span\b[^>]*class\s*=\s*"[^"]*\bfr\b[^"]*"[^>]*>([^<]*)<\/span>/) || [])[1] || "";

    const unread = /redPoint/.test(full);

    items.push({
      title,
      status_label: statusSpan,
      status_code: canonicalStatus(statusSpan),
      course_name: course,
      deadline,
      task_url: dataUrl,
      unread,
      course_id: courseId,
      class_id: classId,
    });
  }

  return items;
}

export { parseHomeworkHtml };
