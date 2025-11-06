#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import sys
import urllib.parse
import requests
from typing import Optional, Dict, Any, List, Set


def build_url(base_url: str, path: str, query: Optional[Dict[str, Any]] = None) -> str:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    if query:
        qs = urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        url = f"{url}?{qs}"
    return url


def http_get_json(url: str, headers: Dict[str, str]) -> Dict[str, Any]:
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()


def is_closed(issue: Dict[str, Any], closed_status_names: Set[str]) -> bool:
    if issue.get("closed_on"):
        return True
    status = (issue.get("status") or {}).get("name", "").lower()
    return status in closed_status_names


def to_workitem(base_url: str, issue: Dict[str, Any]) -> Dict[str, Any]:
    issue_id = issue.get("id")
    get_name = lambda obj: (obj or {}).get("name", "").strip() or None

    return {
        "id": f"redmine:{issue_id}",
        "title": issue.get("subject") or f"Redmine Issue {issue_id}",
        "description": issue.get("description") or "",
        "url": f"{base_url.rstrip('/')}/issues/{issue_id}",
        "kind": "task",
        "attributes": {
            "provider": "redmine",
            "project": get_name(issue.get("project")),
            "status": get_name(issue.get("status")),
            "assignee": get_name(issue.get("assigned_to")),
            "priority": get_name(issue.get("priority")),
            "tracker": get_name(issue.get("tracker")),
            "dueDate": issue.get("due_date"),
            "updatedAt": issue.get("updated_on"),
        },
    }


def fetch_issues(base_url: str, api_key: str, project_id: Optional[str], query_id: Optional[str]) -> List[Dict[str, Any]]:
    # Fix hostname: redmine -> localhost to avoid DNS issues
    parsed = urllib.parse.urlparse(base_url)
    if (parsed.hostname or "").lower() == "redmine":
        netloc = f"localhost:{parsed.port}" if parsed.port else "localhost"
        base_url = urllib.parse.urlunparse(parsed._replace(netloc=netloc))

    headers = {"X-Redmine-API-Key": api_key}
    issues = []
    offset = 0
    limit = 100

    while True:
        query = {"limit": limit, "offset": offset, "status_id": "*"}
        if project_id:
            query["project_id"] = project_id
        if query_id:
            query["query_id"] = query_id

        payload = http_get_json(build_url(base_url, "/issues.json", query), headers)
        batch = payload.get("issues", [])
        if not batch:
            break

        issues.extend(batch)
        offset += len(batch)
        if offset >= payload.get("total_count", len(batch)):
            break

    return issues


def main() -> None:
    try:
        base_url = os.getenv("REDMINE_BASE_URL") or os.getenv("REDMINE_URL") or "http://redmine:3000"
        api_key = os.getenv("REDMINE_API_KEY", "2f919115c077b0c86a346028596400087fd78c6c")
        project_id = os.getenv("REDMINE_PROJECT_ID", "1")
        query_id = os.getenv("REDMINE_QUERY_ID")

        closed_names = set(s.strip().lower() for s in (os.getenv("REDMINE_CLOSED_STATUS_NAMES", "closed,resolved,done") or "").split(",") if s.strip())

        all_issues = fetch_issues(base_url, api_key, project_id, query_id)
        open_issues = [i for i in all_issues if not is_closed(i, closed_names)]
        items = [to_workitem(base_url, issue) for issue in open_issues]

        sys.stdout.write(json.dumps({"ok": True, "items": items}, ensure_ascii=False))
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": str(e), "items": []}, ensure_ascii=False))


if __name__ == "__main__":
    main()
