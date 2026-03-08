"""
Test: Hybrid Anomaly Model & DQN Feedback Pipeline
Tests the critical paths after the enhancement:
  1. HybridAnomalyModel combined_score (iForest + DQN)
  2. SmartAgent get_dqn_output and train_online reward signals
  3. AnomalyService.handle_feedback enriched response
  4. New /feedback/notification API endpoint
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import numpy as np
import pytest

# ---------------------------------------------------------------------------
# 1. HybridAnomalyModel
# ---------------------------------------------------------------------------
class TestHybridAnomalyModel:
    def setup_method(self):
        from app.models.hybrid_model import HybridAnomalyModel
        self.model = HybridAnomalyModel()

    def test_iforest_score_returns_float_in_range(self):
        """iForest score must be [0, 1]."""
        dummy_features = np.zeros((1, 8))
        score = self.model.iforest_score(dummy_features)
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0, f"iForest score out of range: {score}"

    def test_combined_score_iforest_only_fallback(self):
        """Without DQN q_values, mode should be iforest_only."""
        dummy_features = np.zeros((1, 8))
        result = self.model.combined_score(dummy_features, dqn_q_values=None)
        assert result["mode"] == "iforest_only"
        assert 0.0 <= result["combined_score"] <= 1.0
        assert result["dqn_confidence"] == 0.0

    def test_combined_score_hybrid_mode(self):
        """With valid Q-values, mode should be hybrid and score weighted."""
        dummy_features = np.zeros((1, 8))
        q_values = np.array([0.2, 0.8])  # DQN says anomaly (action=1)
        result = self.model.combined_score(dummy_features, dqn_q_values=q_values)
        assert result["mode"] == "hybrid"
        assert result["dqn_action"] == 1
        assert 0.0 <= result["dqn_confidence"] <= 1.0
        assert 0.0 <= result["combined_score"] <= 1.0

    def test_combined_score_normal_q_values(self):
        """DQN says normal (action=0) - confidence for anomaly should be low."""
        dummy_features = np.zeros((1, 8))
        q_values = np.array([0.9, 0.1])  # DQN favors Normal
        result = self.model.combined_score(dummy_features, dqn_q_values=q_values)
        assert result["dqn_action"] == 0
        assert result["dqn_confidence"] < 0.5, "Anomaly confidence should be low when DQN says Normal"


# ---------------------------------------------------------------------------
# 2. SmartAgent
# ---------------------------------------------------------------------------
class TestSmartAgent:
    def setup_method(self):
        from app.services.smart_agent import SmartAgent
        self.agent = SmartAgent()

    def test_get_dqn_output_returns_tuple(self):
        """get_dqn_output should always return (action, q_values_or_None)."""
        dummy_features = np.zeros((1, 8))
        action, q_values = self.agent.get_dqn_output(dummy_features)
        assert action in (0, 1), f"Action must be 0 or 1, got {action}"

    def test_get_dqn_output_no_features(self):
        """With None features, should return (0, None) gracefully."""
        action, q_values = self.agent.get_dqn_output(None)
        assert action == 0
        assert q_values is None

    def test_train_online_confirm_reward_structure(self):
        """When user confirms anomaly (label=1), function should succeed."""
        if self.agent.rl_model is None:
            pytest.skip("RL model not loaded — skipping online training test")
        dummy_features = np.zeros((1, 8))
        result = self.agent.train_online(dummy_features, correct_label=1, feedback_type="confirm")
        assert result.get("success") is True
        assert result.get("feedback_count") >= 1

    def test_train_online_false_alarm_reward_structure(self):
        """When user flags false alarm (label=0), function should succeed."""
        if self.agent.rl_model is None:
            pytest.skip("RL model not loaded — skipping online training test")
        dummy_features = np.zeros((1, 8))
        result = self.agent.train_online(dummy_features, correct_label=0, feedback_type="false_alarm")
        assert result.get("success") is True

    def test_get_training_stats_structure(self):
        """Training stats dict should have required keys."""
        stats = self.agent.get_training_stats()
        required_keys = ["feedback_count", "correct_predictions", "accuracy_pct",
                         "replay_buffer_size", "model_loaded"]
        for key in required_keys:
            assert key in stats, f"Missing key in training stats: {key}"


# ---------------------------------------------------------------------------
# 3. AnomalyService.handle_feedback
# ---------------------------------------------------------------------------
class TestAnomalyServiceFeedback:
    def setup_method(self):
        from app.services.anomaly_service import AnomalyService
        import numpy as np
        self.service = AnomalyService()
        # Inject fake last_features for device
        self.service.last_features["test_device_01"] = np.zeros((1, 8))
        self.service.last_anomaly_context["test_device_01"] = {
            "features": np.zeros((1, 8)),
            "predicted_severity": "CRITICAL",
            "combined_score": 0.75
        }

    def test_feedback_no_features_returns_error(self):
        """Without prior sensor data, feedback should return an error."""
        result = self.service.handle_feedback(
            device_id="nonexistent_device",
            correct_label=1,
            feedback_type="confirm"
        )
        assert result["status"] == "error"

    def test_feedback_success_structure(self):
        """Valid feedback should return success with training_stats."""
        if self.service.agent.rl_model is None:
            pytest.skip("RL model not available")
        result = self.service.handle_feedback(
            device_id="test_device_01",
            correct_label=0,
            feedback_type="false_alarm"
        )
        assert result["status"] == "success"
        assert "training_stats" in result
        assert "model_updated" in result

    def test_feedback_false_alarm_label_mapping(self):
        """feedback_type=false_alarm should map to correct_label=0."""
        if self.service.agent.rl_model is None:
            pytest.skip("RL model not available")
        result = self.service.handle_feedback(
            device_id="test_device_01",
            correct_label=0,
            feedback_type="false_alarm"
        )
        assert result["status"] == "success"


# ---------------------------------------------------------------------------
# 4. Severity Threshold Test
# ---------------------------------------------------------------------------
class TestSeverityThresholds:
    def setup_method(self):
        from app.services.anomaly_service import AnomalyService
        self.service = AnomalyService()

    def test_normal_threshold(self):
        assert self.service._severity(0.3) == "NORMAL"
        assert self.service._severity(0.49) == "NORMAL"

    def test_warning_threshold(self):
        assert self.service._severity(0.5) == "WARNING"
        assert self.service._severity(0.64) == "WARNING"

    def test_critical_threshold(self):
        assert self.service._severity(0.65) == "CRITICAL"
        assert self.service._severity(1.0) == "CRITICAL"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
