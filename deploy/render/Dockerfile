# Bản chạy thật trên Render. Render KHÔNG có runtime .NET sẵn nên bắt buộc dùng Docker.
# KHÔNG có bí mật nào trong tệp này — mọi bí mật truyền qua biến môi trường của Render.
#
# Context build là GỐC REPO (vì tệp này COPY cả frontend/ lẫn backend/):
#   Render > New > Web Service > Docker, Dockerfile Path = deploy/render/Dockerfile

# ---------- Tầng 1: build giao diện ----------
FROM node:22-alpine AS giao-dien
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# /api là đường dẫn tương đối — đúng khi API phục vụ luôn giao diện (cùng tên miền).
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------- Tầng 2: build API + nhúng giao diện ----------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
WORKDIR /src
COPY backend/ClassManagement.Api/ClassManagement.Api.csproj ./
RUN dotnet restore
COPY backend/ClassManagement.Api/ ./
COPY --from=giao-dien /fe/dist ./wwwroot/
RUN dotnet publish -c Release -o /app --no-restore

# ---------- Tầng 3: chạy ----------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS chay
WORKDIR /app
COPY --from=api /app ./
ENV ASPNETCORE_ENVIRONMENT=Production
# Render free chỉ có 512 MB RAM / 0.1 CPU: Server GC mặc định của ASP.NET Core ăn RAM hơn hẳn và
# không lợi gì trên một lõi ảo, nên chuyển sang Workstation GC cho khỏi bị OOM-kill.
ENV DOTNET_gcServer=0
ENV DOTNET_GCHeapHardLimit=0x14000000
EXPOSE 8080
# Render cấp cổng qua biến PORT: app phải nghe đúng cổng đó, không được cứng 5080.
CMD ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} dotnet ClassManagement.Api.dll"]
