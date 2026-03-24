# API Documentation

## Endpoints

### GET /api/matches/combined
Returns merged match rows from Forebet, OLBG and Vitibet.

Quick example:

```bash
curl -s http://localhost:3001/api/matches/combined | jq '.[0]'
```

### GET /api/forebet/today
Returns today's Forebet list.

### GET /api/forebet/match/:matchKey
Returns detailed Forebet stats for one match.

Quick example:

```bash
curl -s http://localhost:3001/api/forebet/match/arsenal-vs-chelsea | jq
```

### GET /api/forebet/details/:matchKey
Returns on-demand deep Forebet details for one match (cached 20 minutes).

Quick example:

```bash
curl -s http://localhost:3001/api/forebet/details/arsenal-vs-chelsea | jq
```

### GET /api/olbg/today
Returns OLBG tips list.

### GET /api/vitibet/today
Returns Vitibet tips list.

### GET /api/matches/pair-suggestions
Returns uncertain cross-source pair suggestions for manual review.

### POST /api/matches/pair-suggestions/approve
Approves one suggested pair merge.

Body:

```json
{
	"source": "olbg",
	"candidateId": "arsenal-vs-chelsea",
	"targetId": "arsenal-vs-chelsea"
}
```

## Error format
Backend returns JSON errors in this format:

```json
{ "error": "Not found" }
```

## Notes
- `matchKey` is the canonical ID for frontend row actions.
- Backend also keeps source `id` for compatibility.
- Forebet deep details scrape is only executed on explicit endpoint call.
