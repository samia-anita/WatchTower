const { v4: uuidv4 } = require('uuid');

// Common log format patterns
const PATTERNS = {
  // Apache/Nginx combined log format
  APACHE: /^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)\s+\S+(?:\s+"([^"]*)")?(?:\s+"([^"]*)")?/,
  // Syslog format
  SYSLOG: /^(\w{3}\s+\d+\s+[\d:]+)\s+(\S+)\s+(\S+)(?:\[(\d+)\])?:\s+(.+)/,
  // Generic timestamp + message
  GENERIC_TS: /^(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.+)/,
  // ISO timestamp
  ISO_TS: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,
  // IP address extraction
  IP: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/,
  // HTTP method
  HTTP_METHOD: /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\b/,
  // HTTP status code
  HTTP_STATUS: /\s(\d{3})\s/,
  // Failed login keywords
  FAILED_AUTH: /failed|failure|invalid|incorrect|unauthorized|authentication error|login failed|bad password|wrong password|access denied/i,
  // SQL patterns
  SQL_INJECT: /(\bOR\s+['"0-9]+=\s*['"0-9]+|UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO\s+\w+|DELETE\s+FROM|UPDATE\s+\w+\s+SET|EXEC\s*\(|EXECUTE\s*\(|xp_cmdshell|--\s*$|\/\*.*\*\/)/i,
  // XSS patterns
  XSS: /(<script[\s>]|javascript:|onerror\s*=|onload\s*=|onclick\s*=|<iframe|document\.cookie|alert\s*\(|eval\s*\(|\.innerHTML\s*=)/i,
  // Path traversal
  PATH_TRAV: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%252e%252e|\/etc\/passwd|\/etc\/shadow|\/etc\/hosts|\/windows\/system32|cmd\.exe|powershell\.exe)/i,
};

function parseLogFile(content, scanId) {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const event = parseLine(line, i + 1, scanId);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

function parseLine(line, lineNumber, scanId) {
  const event = {
    id: uuidv4(),
    scan_id: scanId,
    raw_line: line,
    line_number: lineNumber,
    timestamp: null,
    source_ip: null,
    event_type: 'generic',
    method: null,
    path: null,
    status_code: null,
    user_agent: null,
  };

  // Try Apache/Nginx format first
  const apacheMatch = line.match(PATTERNS.APACHE);
  if (apacheMatch) {
    event.source_ip = apacheMatch[1];
    event.timestamp = apacheMatch[3];
    event.method = apacheMatch[4];
    event.path = apacheMatch[5];
    event.status_code = apacheMatch[6];
    event.user_agent = apacheMatch[8] || null;
    event.event_type = 'http_access';
    return event;
  }

  // Try syslog format
  const syslogMatch = line.match(PATTERNS.SYSLOG);
  if (syslogMatch) {
    event.timestamp = syslogMatch[1];
    event.event_type = 'syslog';
    const ipMatch = line.match(PATTERNS.IP);
    if (ipMatch) event.source_ip = ipMatch[1];
    return event;
  }

  // Try generic timestamp format
  const genericMatch = line.match(PATTERNS.GENERIC_TS);
  if (genericMatch) {
    event.timestamp = genericMatch[1];
    const rest = genericMatch[2];
    const ipMatch = rest.match(PATTERNS.IP);
    if (ipMatch) event.source_ip = ipMatch[1];
    const methodMatch = rest.match(PATTERNS.HTTP_METHOD);
    if (methodMatch) {
      event.method = methodMatch[1];
      event.event_type = 'http_request';
    }

    if (PATTERNS.FAILED_AUTH.test(line)) {
      event.event_type = 'auth_failure';
    }
    return event;
  }

  // Fallback: try to extract anything useful
  const ipMatch = line.match(PATTERNS.IP);
  if (ipMatch) event.source_ip = ipMatch[1];
  const methodMatch = line.match(PATTERNS.HTTP_METHOD);
  if (methodMatch) event.method = methodMatch[1];
  if (PATTERNS.FAILED_AUTH.test(line)) event.event_type = 'auth_failure';

  return event;
}

module.exports = { parseLogFile, PATTERNS };
