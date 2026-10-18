from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserOut, UserUpdate
from app.core.security import hash_password, verify_password, create_access_token
from app.core.rate_limiter import rate_limit_auth
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserRegister,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit_auth)
):
    # Check if user already exists
    existing = db.execute(select(User).where(User.email == user_in.email.lower())).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    user = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id)

    # Set secure HttpOnly cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
def login(
    user_in: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit_auth)
):
    user = db.execute(select(User).where(User.email == user_in.email.lower())).scalar_one_or_none()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact support."
        )

    access_token = create_access_token(subject=user.id)

    # Set secure HttpOnly cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "Successfully logged out."}


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.password is not None:
        current_user.hashed_password = hash_password(user_update.password)
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)
