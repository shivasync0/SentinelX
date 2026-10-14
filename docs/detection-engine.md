# Detection engine

The engine is deterministic and inspectable. It does not call an LLM and does not
claim that a heuristic score is a probability of maliciousness.

## Name matching

`normalize_name` applies Unicode NFKD, selected explicit confusable substitutions,
case folding, accent removal, and separator removal. `name_similarity` uses a stable
`difflib.SequenceMatcher` ratio. Exact literal equality is kept separate so a
registered official name can be excluded while a `Secur1ty` variant remains a
candidate.

The current thresholds are:

| Similarity | Signal | Weight |
| --- | --- | ---: |
| >= 0.78 | `look_alike_name` | 0.65 |
| >= 0.55 | `related_name` | 0.30 |
| otherwise | no name signal | 0 |

Additional deterministic context signals cover unapproved domains, source
provenance, and higher-risk candidate surfaces such as phishing, login, or social.
Weights are additive and capped at `1.0`.

## Official-asset precedence

Before any risk score is returned, the candidate is compared with each active
official asset by:

1. Exact literal asset/candidate name.
2. Canonical hostname equality.
3. Exact brand canonical name.

Platform host equality alone is intentionally not enough. For example, two different
profiles hosted by the same social platform are not the same official account.
Retired assets are not used for exclusion.

## Limitations

No claim is made that the current engine detects every character confusable, copied
image, malicious redirect, or coordinated actor. Image hashing, OCR, publisher
verification, and live APIs are extension points. Analysts should use the score to
prioritize review and record a human decision through the feedback endpoint.
