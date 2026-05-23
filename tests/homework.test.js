import { describe, expect, it } from "vitest";
import { parseHomeworkHtml } from "../src/homework.js";

const sampleHtml = `
<html>
<body>
<ul>
<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/android/mtaskmsgspecial?taskrefId=100&msgId=0&courseId=1&clazzId=10&enc_task=aaa">
  <span class="spanImg">
    <img src="task-work.png">
    <i class="redPoint"></i>
  </span>
  <div role="option">
    <p>Chapter 1 Assignment</p>
    <span class="status">未提交</span>
    <span>《Data Science》</span>
    <span class="fr">剩余7天</span>
  </div>
</li>
<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/android/mtaskmsgspecial?taskrefId=200&msgId=0&courseId=2&clazzId=20&enc_task=bbb">
  <span class="spanImg">
    <img src="task-work.png">
  </span>
  <div role="option">
    <p>Lab Report</p>
    <span class="status">已完成</span>
    <span>《Linux Operations》</span>
    <span class="fr">已截止</span>
  </div>
</li>
<li onclick="goTask(this);" data="https://mooc1.chaoxing.com/mooc-ans/android/mtaskmsgspecial?taskrefId=300&msgId=0&courseId=1&clazzId=10&enc_task=ccc">
  <span class="spanImg">
    <img src="task-work.png">
  </span>
  <div role="option">
    <p>Final Project</p>
    <span class="status">待批阅</span>
    <span>《Data Science》</span>
    <span class="fr">剩余3小时</span>
  </div>
</li>
</ul>
</body>
</html>
`;

describe("parseHomeworkHtml", () => {
  it("extracts all homework items from HTML", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items).toHaveLength(3);
  });

  it("parses title from <p> inside <div role='option'>", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].title).toBe("Chapter 1 Assignment");
    expect(items[1].title).toBe("Lab Report");
    expect(items[2].title).toBe("Final Project");
  });

  it("parses status_label from <span class='status'>", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].status_label).toBe("未提交");
    expect(items[1].status_label).toBe("已完成");
    expect(items[2].status_label).toBe("待批阅");
  });

  it("maps status_label to canonical status_code", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].status_code).toBe("Pending");
    expect(items[1].status_code).toBe("Completed");
    expect(items[2].status_code).toBe("Completed");
  });

  it("parses course_name from 《...》 pattern", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].course_name).toBe("Data Science");
    expect(items[1].course_name).toBe("Linux Operations");
    expect(items[2].course_name).toBe("Data Science");
  });

  it("parses deadline from <span class='fr'>", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].deadline).toBe("剩余7天");
    expect(items[1].deadline).toBe("已截止");
    expect(items[2].deadline).toBe("剩余3小时");
  });

  it("parses task_url from data attribute on <li>", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].task_url).toContain("taskrefId=100");
    expect(items[1].task_url).toContain("taskrefId=200");
    expect(items[2].task_url).toContain("taskrefId=300");
  });

  it("detects unread from redPoint class presence", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].unread).toBe(true);
    expect(items[1].unread).toBe(false);
    expect(items[2].unread).toBe(false);
  });

  it("returns empty array for HTML with no homework items", () => {
    expect(parseHomeworkHtml("<html><body>no homework here</body></html>")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseHomeworkHtml("")).toEqual([]);
  });

  it("extracts course_id from task_url", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].course_id).toBe(1);
    expect(items[1].course_id).toBe(2);
    expect(items[2].course_id).toBe(1);
  });

  it("extracts class_id from task_url", () => {
    const items = parseHomeworkHtml(sampleHtml);
    expect(items[0].class_id).toBe(10);
    expect(items[1].class_id).toBe(20);
    expect(items[2].class_id).toBe(10);
  });

  it("handles missing status span gracefully", () => {
    const html = `<li onclick="goTask(this);" data="https://example.com">
      <div role="option"><p>Title</p><span>《Course》</span><span class="fr">tomorrow</span></div>
    </li>`;
    const items = parseHomeworkHtml(html);
    expect(items[0].status_label).toBe("");
    expect(items[0].status_code).toBe("Unknown");
  });

  it("parses status without class=\"status\" attribute", () => {
    const html = `<li onclick="goTask(this);" data="https://example.com?courseId=1">
      <div role="option">
        <p>Title</p>
        <span aria-hidden="true">待批阅</span>
        <span aria-hidden="true">《Course》</span>
        <span class="fr">剩余1天</span>
      </div>
    </li>`;
    const items = parseHomeworkHtml(html);
    expect(items[0].status_label).toBe("待批阅");
    expect(items[0].status_code).toBe("Completed");
  });
});
