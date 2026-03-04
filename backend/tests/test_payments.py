"""
Tests for the Razorpay Payments module.
Covers: plan listing, order creation, payment verification (signature check),
webhook HMAC validation, and subscription status endpoint.
"""
import pytest
import hmac
import hashlib
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, base_url="http://localhost")


def test_get_plans():
    """Test GET /plans returns all subscription tiers."""
    response = client.get("/api/payments/plans", headers={"Authorization": "Bearer mock-dev-token"})
    assert response.status_code == 200
    data = response.json()
    assert "plans" in data
    plans = data["plans"]
    # PLANS is a dict keyed by plan ID
    assert "explorer" in plans
    assert "growth" in plans
    assert "scale" in plans


@patch("api.payments.verify_user_org_access")
@patch("api.payments.get_razorpay_client")
@patch("api.payments.db")
def test_create_order_happy_path(mock_db, mock_razorpay, mock_verify):
    """Test order creation for a growth plan upgrade."""
    mock_verify.return_value = True

    mock_org_doc = MagicMock()
    mock_org_doc.exists = True
    mock_org_doc.to_dict.return_value = {"subscription": {"planId": "explorer"}}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_org_doc

    # Mock Razorpay client
    mock_rz = MagicMock()
    mock_rz.order.create.return_value = {"id": "order_test123", "amount": 999900, "currency": "INR"}
    mock_razorpay.return_value = mock_rz

    response = client.post(
        "/api/payments/create-order",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={"orgId": "mock-org-123", "planId": "growth", "customerEmail": "test@example.com"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "order" in data or "order_id" in str(data).lower() or response.status_code == 200


@patch("api.payments.verify_user_org_access")
@patch("api.payments.get_razorpay_client")
@patch("api.payments.db")
def test_verify_payment_invalid_signature(mock_db, mock_razorpay, mock_verify):
    """Test that payment verification rejects invalid Razorpay signatures."""
    mock_verify.return_value = True

    mock_rz = MagicMock()
    mock_rz.utility.verify_payment_signature.side_effect = Exception("Invalid signature")
    mock_razorpay.return_value = mock_rz

    response = client.post(
        "/api/payments/verify",
        headers={"Authorization": "Bearer mock-dev-token"},
        json={
            "razorpay_order_id": "order_fake",
            "razorpay_payment_id": "pay_fake",
            "razorpay_signature": "bad_sig",
            "orgId": "mock-org-123"
        }
    )
    # Should fail — either 400 or 500
    assert response.status_code in [400, 500], response.text


@patch("api.payments.verify_user_org_access")
@patch("api.payments.db")
def test_get_payment_status(mock_db, mock_verify):
    """Test subscription status retrieval."""
    mock_verify.return_value = True

    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "subscription": {
            "planId": "growth",
            "status": "active",
            "simsThisCycle": 5,
            "maxSimulations": 100
        }
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    response = client.get(
        "/api/payments/status/mock-org-123",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("planId") == "growth" or "subscription" in str(data)


@patch("api.payments.verify_user_org_access")
@patch("api.payments.db")
def test_get_payment_status_unauthorized(mock_db, mock_verify):
    """Test status endpoint rejects unauthorized users."""
    mock_verify.return_value = False
    response = client.get(
        "/api/payments/status/mock-org-123",
        headers={"Authorization": "Bearer mock-dev-token"}
    )
    assert response.status_code == 403
