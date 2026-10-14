from types import SimpleNamespace

from app.detection import (
    calculate_name_similarity, detect_added_brand_terms, detect_character_substitutions,
    detect_transpositions, detect_unicode_confusables, generate_name_variants,
    is_lookalike, name_similarity, normalize_name, score_candidate,
)


def test_normalization_handles_case_accents_separators_and_confusables():
    assert normalize_name("  Acmé-Secur1ty! ") == "acmesecurity"
    assert name_similarity("Acme Security", "acme-security") == 1.0


def test_lookalike_name_is_detected_but_exact_name_is_not():
    assert is_lookalike("Acme Secur1ty", "Acme Security")
    assert not is_lookalike("Acme Security", "Acme Security")


def test_name_signal_helpers_explain_common_variants():
    assert "acmesecurity" in generate_name_variants("Acme Security")
    assert detect_character_substitutions("Acme Secur1ty", "Acme Security")
    assert detect_unicode_confusables("Acme Securіty", "Acme Security")
    assert detect_transpositions("Acme Securtiy", "Acme Security")
    assert detect_added_brand_terms("Acme Security Support", "Acme Security") == ["support"]
    assert calculate_name_similarity("Acme-Security", "Acme Security") == 1.0


def test_official_asset_exclusion_has_precedence_over_risk_signals():
    brand = SimpleNamespace(name="Acme Security", canonical_name="Acme Security", domains=["acme.security"])
    candidate = SimpleNamespace(name="Acme Security", domain="acme.security", url="https://acme.security", candidate_type="phishing", source_id=9)
    asset = SimpleNamespace(name="Acme Security", url="https://acme.security")
    result = score_candidate(candidate, brand, [asset])
    assert result.excluded is True
    assert result.score == 0
    assert result.risk_level == "excluded"
    assert result.explanation[0].signal == "official_asset"


def test_scoring_is_explainable_and_bounded():
    brand = SimpleNamespace(name="Acme Security", canonical_name="Acme Security", domains=["acme.security"])
    candidate = SimpleNamespace(name="Acme Secur1ty", domain="acme-security-login.com", url=None, candidate_type="phishing", source_id=3)
    result = score_candidate(candidate, brand, [])
    assert 0 < result.score <= 1
    assert result.risk_level in {"low", "medium", "high", "critical"}
    assert {signal.signal for signal in result.explanation} >= {"look_alike_name", "unverified_domain", "external_source", "high_risk_surface"}
    assert all(signal.evidence and signal.weight >= 0 for signal in result.explanation)


def test_shared_social_platform_host_does_not_exclude_another_profile():
    brand = SimpleNamespace(canonical_name="Acme Security", domains=["acme.security"])
    candidate = SimpleNamespace(name="Acme Secur1ty Help", domain="social.example", url="https://social.example/fake", candidate_type="social")
    asset = SimpleNamespace(name="Official Profile", url="https://social.example/official", asset_type="social", status="verified")
    assert score_candidate(candidate, brand, [asset]).excluded is False
    candidate.url = "HTTPS://SOCIAL.EXAMPLE:443/official#bio"
    assert score_candidate(candidate, brand, [asset]).excluded is True


def test_retired_assets_do_not_exclude_candidates():
    brand = SimpleNamespace(canonical_name="Acme Security", domains=[])
    candidate = SimpleNamespace(name="Acme Secur1ty", domain="acme.example", candidate_type="domain")
    asset = SimpleNamespace(name="Different name", url="https://acme.example", status="retired")
    assert score_candidate(candidate, brand, [asset]).excluded is False
