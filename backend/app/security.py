from __future__ import annotations

import hashlib
import hmac
import os
import time
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer

from .config import ACCESS_TOKEN_EXPIRE_MIN, ALGORITHM, SECRET_KEY
from .store import Org, User, store


@dataclass
class IngestCtx:
    org: Org
    source: Optional[str] = None
    api_key_id: Optional[str] = None


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + "$" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 100_000)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def create_token(user_id: str, org_id: str) -> str:
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "exp": int(time.time()) + ACCESS_TOKEN_EXPIRE_MIN * 60,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Невалидный или истёкший токен")


oauth2 = OAuth2PasswordBearer(tokenUrl="/v1/auth/login", auto_error=False)


def get_current_user(token: Optional[str] = Depends(oauth2)) -> User:
    if not token:
        raise HTTPException(401, "Не авторизован")
    user = store.users_by_id.get(_decode(token).get("sub"))
    if not user:
        raise HTTPException(401, "Пользователь не найден")
    return user


def get_current_org(user: User = Depends(get_current_user)) -> Org:
    org = store.orgs.get(user.org_id)
    if not org:
        raise HTTPException(404, "Организация не найдена")
    return org


def get_ingest_org(
    x_org_key: Optional[str] = Header(default=None, alias="X-Org-Key"),
    token: Optional[str] = Depends(oauth2),
) -> Org:
    if x_org_key:
        org = store.org_by_key.get(x_org_key)
        if not org:
            raise HTTPException(401, "Неверный X-Org-Key")
        return org
    if token:
        org = store.orgs.get(_decode(token).get("org_id"))
        if org:
            return org
    raise HTTPException(401, "Нужен заголовок X-Org-Key или Bearer-токен")


def get_ingest_ctx(
    x_org_key: Optional[str] = Header(default=None, alias="X-Org-Key"),
    token: Optional[str] = Depends(oauth2),
) -> IngestCtx:
    if x_org_key:
        ak = store.get_api_key(x_org_key)
        if ak is not None:
            if ak.revoked:
                raise HTTPException(401, "Ключ источника отозван")
            if ak.scope not in ("ingest", "full"):
                raise HTTPException(403, "У ключа нет прав на приём событий (scope: read)")
            org = store.orgs.get(ak.org_id)
            if not org:
                raise HTTPException(401, "Организация не найдена")
            store.touch_api_key(ak)
            return IngestCtx(org=org, source=ak.name, api_key_id=ak.id)
        org = store.org_by_key.get(x_org_key)
        if org:
            return IngestCtx(org=org, source=None)
        raise HTTPException(401, "Неверный X-Org-Key")
    if token:
        org = store.orgs.get(_decode(token).get("org_id"))
        if org:
            return IngestCtx(org=org, source="Дашборд")
    raise HTTPException(401, "Нужен заголовок X-Org-Key или Bearer-токен")


def get_org_for_stream(
    token: Optional[str] = Query(default=None),
    header_token: Optional[str] = Depends(oauth2),
) -> Org:
    tok = token or header_token
    if not tok:
        raise HTTPException(401, "Нужен токен (?token=...)")
    org = store.orgs.get(_decode(tok).get("org_id"))
    if not org:
        raise HTTPException(404, "Организация не найдена")
    return org
