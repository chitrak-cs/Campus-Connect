const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// validate(schema, source) -> 400 with the first issue's message; replaces the source with parsed data
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
    return res.status(400).json({ message: `${field}${issue.message}` });
  }
  req[source] = result.data;
  next();
};

// Route params named here must be UUIDs (avoids Postgres 500s)
const uuidParams = (...names) => (req, res, next) => {
  for (const n of names) {
    if (!isUuid(req.params[n])) return res.status(400).json({ message: `Invalid ${n}` });
  }
  next();
};

module.exports = { validate, uuidParams, isUuid };
