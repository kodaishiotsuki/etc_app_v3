from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView

from app.api.users import router as users_router
from app.database.database import engine
from app.models.user import User

app = FastAPI(
    title="FastAPI App",
    description="FastAPI application",
    version="1.0.0",
)

# CORSの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.jsのデフォルトポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLAdminの設定
admin = Admin(app, engine)


class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.username, User.created_at, User.updated_at]
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"


admin.add_view(UserAdmin)

# APIルーターの追加
app.include_router(users_router, prefix="/api", tags=["users"])


@app.get("/")
async def root():
    return {"message": "Hello World"}
