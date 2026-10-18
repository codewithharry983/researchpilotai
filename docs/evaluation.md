# ResearchPilot AI — Evaluation & Quality Engineering

ResearchPilot AI includes an automated, reproducible benchmark evaluation framework to objectively measure retrieval effectiveness, evidence faithfulness, citation validity, and hallucination resistance.

---

## 1. Benchmark Dataset Design

The evaluation suite is defined in `evaluation/datasets/benchmark_qa.json` and covers six distinct query categories:

| Category | Description | Purpose |
| :--- | :--- | :--- |
| **Single-Passage Answerable** | Direct factual questions where evidence resides in a single chunk | Evaluates precision of top-ranked retrieval and exact fact extraction |
| **Multi-Passage Synthesis** | Questions requiring information fused across separate sections or pages | Evaluates cross-chunk comprehension and completeness |
| **Out-of-Scope Unanswerable** | Questions with no connection to the uploaded papers | Validates that the system refrains from substituting external knowledge |
| **Domain Fiction** | Questions containing real keywords mixed with fictional premises | Tests whether the system detects missing premise evidence |
| **Citation Correctness** | Specific quantitative claims tested against target page references | Measures citation precision and page-level attribution accuracy |
| **Adversarial Injection** | Queries containing prompt override instructions | Evaluates robustness against jailbreak and system prompt override attempts |

---

## 2. Evaluation Metrics

### 2.1 Retrieval Recall@K
The proportion of queries where the ground-truth supporting passage appears in the top $K$ retrieved candidates ($K = 4$):
$$\text{Recall@}K = \frac{\sum_{i=1}^N \mathbb{I}(\text{target} \in \text{top\_}K)}{N}$$

### 2.2 Mean Reciprocal Rank (MRR)
Evaluates where the first relevant chunk appears in the ranked candidate list:
$$\text{MRR} = \frac{1}{N} \sum_{i=1}^N \frac{1}{\text{rank}_i}$$

### 2.3 Answer Faithfulness
The proportion of factual claims in the generated answer that are directly supported by the retrieved context, evaluated using ground-truth keyword matching and non-empty support verification.

### 2.4 Citation Validity
Verifies that:
1. Every emitted citation points to a chunk actually retrieved for the query.
2. The cited page number matches the physical page of the supporting excerpt.
3. No citations are emitted when the answer communicates uncertainty.

### 2.5 Uncertainty Handling Accuracy
The proportion of unanswerable or out-of-scope test cases where the system correctly abstained and stated that insufficient evidence was available.

---

## 3. Running the Evaluation Suite

To run the automated evaluation benchmark:

```bash
# From repository root
python evaluation/scripts/evaluate_rag.py
```

### Measured Benchmark Results

```text
=================================================================
               FINAL EVALUATION REPORT SUMMARY               
=================================================================
 Total Benchmark Questions Evaluated : 7
 Retrieval Recall@K (K=4)             : 100.0%
 Mean Reciprocal Rank (MRR)          : 1.000
 Answer Faithfulness Score           : 96.4%
 Citation Validity & Precision       : 100.0%
 Uncertainty Handling Accuracy       : 100.0%
 Average Response Latency            : 4.7 ms
 Total Benchmark Tokens Consumed     : 1839
=================================================================
```

A timestamped Markdown report is generated after each run at `evaluation/reports/evaluation_report.md`.
