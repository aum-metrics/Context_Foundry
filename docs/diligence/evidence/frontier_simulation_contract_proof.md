# Hard Evidence: Frontier Simulation Contract Proof (Local Baseline)
**Scenario**: Local contract trace of the 3-model parallel Visibility Score scoring engine.
**Captured**: 2026-03-07T01:19:15.179179+00:00
**Status**: `HTTP/1.1 200 OK (Simulated Provider Path)`

## Raw Data Link
[Source Trace (JSON)](raw/frontier_simulation_contract_proof_trace.json)

## HTTP Response Trace
```json
{
  "results": [
    {
      "model": "GPT-4o",
      "answer": "",
      "accuracy": 0,
      "hasHallucination": true,
      "error": "Error code: 401 - {'error': {'message': 'Incorrect API key provided: sk-.... You can find your API key at https://platform.openai.com/account/api-keys.', 'type': 'invalid_request_error', 'code': 'invalid_api_key', 'param': None}, 'status': 401}"
    },
    {
      "model": "Gemini 3 Flash",
      "answer": "This is a simulated response from Gemini 3 Flash for the prompt: 'Summarize the compliance requirements for Project ARGUS.'. In a real environment, this would be generated using your API keys.",
      "accuracy": 86.3,
      "hasHallucination": false,
      "claimResults": [
        {
          "claim": "Mock Claim 1",
          "verdict": "supported",
          "detail": "Simulated verification"
        }
      ],
      "claimScore": "1/1 claims supported"
    },
    {
      "model": "Claude 4.5 Sonnet",
      "answer": "This is a simulated response from Claude 4.5 Sonnet for the prompt: 'Summarize the compliance requirements for Project ARGUS.'. In a real environment, this would be generated using your API keys.",
      "accuracy": 87.7,
      "hasHallucination": false,
      "claimResults": [
        {
          "claim": "Mock Claim 1",
          "verdict": "supported",
          "detail": "Simulated verification"
        }
      ],
      "claimScore": "1/1 claims supported"
    }
  ],
  "adjudication": null,
  "lockedModels": [
    "Claude 4.5 Sonnet",
    "Gemini 3 Flash"
  ],
  "version": "v5.2",
  "prompt": "Summarize the compliance requirements for Project ARGUS.",
  "claimsExtracted": 0,
  "cached": false,
  "transparency_footprint": {
    "standards": [
      "Deterministic scoring for auditability",
      "Zero-retention ingestion pipeline",
      "Prompt + model traceability"
    ],
    "verification_method": "AI Visibility 60/40 Visibility Score v1.2.0",
    "models_audited": [
      "GPT-4o",
      "Gemini 3 Flash",
      "Claude 4.5 Sonnet"
    ],
    "parameters": {
      "temperature": 0.0,
      "top_p": 1.0,
      "extraction_mode": "deterministic"
    },
    "timestamp": "2026-03-07T01:19:15.176094+00:00"
  }
}
```

---
*AUM Diligence Evidence Layer*
