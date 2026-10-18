import pytest
from fastapi.testclient import TestClient


def test_register_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "Test User"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["full_name"] == "Test User"


def test_register_duplicate_email(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_user.email,
            "password": "AnotherPassword123!",
            "full_name": "Duplicate"
        }
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_register_weak_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@example.com",
            "password": "short",
            "full_name": "Weak Password"
        }
    )
    assert response.status_code == 422


def test_login_success(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user.email,
            "password": "Password123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_user.email


def test_login_invalid_password(client: TestClient, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user.email,
            "password": "WrongPassword!"
        }
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_get_me_authenticated(client: TestClient, test_user, test_user_token):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email


def test_get_me_unauthenticated(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_logout(client: TestClient):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out."
