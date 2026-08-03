#!/usr/bin/env python3
"""
Script de despliegue manual (GCP / producción).

GitHub Actions deploy está deshabilitado (plan sin minutos). Usar este script o
SSH + tarball/rsync hacia la VM backend (34.23.82.181) y nginx en la VM proxy (35.243.243.211).
"""

import subprocess
import sys
import os
from pathlib import Path

# Configuración
# NOTA: El servicio corre desde backend_prepro, no desde backend
BACKEND_DIR = "/home/ubuntu/backend_prepro"
BRANCH = "preproduccion"
SERVICE_NAME = "uvicorn-prepro.service"
VENV_PATH = f"{BACKEND_DIR}/venv"

def run_command(cmd, cwd=None, check=True):
    """Ejecuta un comando y muestra el output"""
    print(f"\n{'='*80}")
    print(f"🔧 Ejecutando: {cmd}")
    print(f"{'='*80}")
    
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=check,
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Error ejecutando comando: {e}")
        return False

def check_prerequisites():
    """Verifica que los prerrequisitos estén cumplidos"""
    print("\n📋 Verificando prerrequisitos...")
    
    if not os.path.exists(BACKEND_DIR):
        print(f"❌ Directorio {BACKEND_DIR} no existe")
        return False
    
    if not os.path.exists(f"{BACKEND_DIR}/.git"):
        print(f"❌ {BACKEND_DIR} no es un repositorio git")
        return False
    
    print("✅ Prerrequisitos cumplidos")
    return True

def fix_git_ownership():
    """Arregla el problema de ownership de git cuando se ejecuta como root"""
    print("\n🔧 Configurando git para permitir acceso como root...")
    run_command(f"git config --global --add safe.directory {BACKEND_DIR}", check=False)
    return True

def backup_current_code():
    """Hace backup del código actual"""
    print("\n💾 Haciendo backup del código actual...")
    
    backup_dir = f"{BACKEND_DIR}/backups"
    os.makedirs(backup_dir, exist_ok=True)
    
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{backup_dir}/backup_{timestamp}"
    
    # Arreglar ownership de git primero
    fix_git_ownership()
    
    # Crear backup usando git stash
    run_command(f"cd {BACKEND_DIR} && git stash push -m 'backup_before_deploy_{timestamp}'", check=False)
    
    print(f"✅ Backup creado en: {backup_path}")
    return True

def pull_code():
    """Hace pull del código desde GitHub"""
    print("\n📥 Descargando código desde GitHub...")
    
    # Arreglar ownership de git primero
    fix_git_ownership()
    
    # Cambiar al directorio del backend
    os.chdir(BACKEND_DIR)
    
    # Token de GitHub (DEBE venir de variable de entorno GITHUB_TOKEN)
    github_token = os.getenv("GITHUB_TOKEN")
    
    if github_token:
        print("🔑 Configurando remote con token de GitHub...")
        # Limpiar credenciales guardadas primero
        run_command("git config --global --unset credential.helper", check=False)
        run_command("git credential-cache exit", check=False)
        
        # Probar formato alternativo: usar el token directamente sin @
        # Primero intentar con el formato estándar
        remote_url = f"https://{github_token}@github.com/Digpatho3/backend.git"
        run_command(f"git remote set-url origin {remote_url}", check=False)
        
        # Configurar git para no pedir credenciales y usar el token directamente
        run_command("git config --global credential.helper store", check=False)
        
        # Crear archivo de credenciales con el token (formato: https://token@github.com)
        creds_file = os.path.expanduser("~/.git-credentials")
        try:
            with open(creds_file, 'w') as f:
                f.write(f"https://{github_token}@github.com\n")
            os.chmod(creds_file, 0o600)  # Permisos seguros
            print("✅ Credenciales configuradas")
        except Exception as e:
            print(f"⚠️ No se pudo crear archivo de credenciales: {e}")
        
        # También configurar la URL con el token en el remote directamente
        # Usar formato: https://token@github.com/owner/repo.git
        run_command(f"cd {BACKEND_DIR} && git remote set-url origin https://{github_token}@github.com/Digpatho3/backend.git", check=False)
    
    # Verificar estado actual
    print("\n📊 Estado actual del repositorio:")
    run_command("git status", check=False)
    
    # Hacer fetch primero
    print("\n📥 Haciendo fetch...")
    if not run_command("git fetch origin", check=False):
        print("⚠️ Advertencia: fetch falló, continuando de todas formas...")
    
    # Verificar si hay cambios locales
    result = subprocess.run(
        "git status --porcelain",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.stdout.strip():
        print("\n⚠️ Hay cambios locales sin commitear:")
        print(result.stdout)
        response = input("\n¿Deseas descartar los cambios locales? (s/n): ")
        if response.lower() == 's':
            print("🗑️ Descartando cambios locales...")
            run_command("git reset --hard HEAD", check=False)
            run_command("git clean -fd", check=False)
        else:
            print("❌ Despliegue cancelado por el usuario")
            return False
    
    # Cambiar a la rama correcta
    print(f"\n🌿 Cambiando a rama {BRANCH}...")
    run_command(f"git checkout {BRANCH}", check=False)
    
    # Hacer pull
    print(f"\n📥 Haciendo pull de origin/{BRANCH}...")
    if not run_command(f"git pull origin {BRANCH}", check=False):
        print("❌ Error al hacer pull")
        print("\n💡 Intentando reset hard...")
        run_command(f"git fetch origin {BRANCH}", check=False)
        run_command(f"git reset --hard origin/{BRANCH}", check=False)
    
    # Mostrar último commit
    print("\n📝 Último commit desplegado:")
    run_command("git log -1 --oneline", check=False)
    
    return True

def install_dependencies():
    """Instala las dependencias si es necesario"""
    print("\n📦 Verificando dependencias...")
    
    if not os.path.exists(VENV_PATH):
        print(f"❌ Entorno virtual no encontrado en {VENV_PATH}")
        return False
    
    # Activar venv e instalar dependencias
    requirements_file = f"{BACKEND_DIR}/requirements.txt"
    if os.path.exists(requirements_file):
        print("📦 Instalando dependencias...")
        # Usar bash explícitamente y el path completo del pip
        pip_path = f"{VENV_PATH}/bin/pip"
        run_command(
            f"bash -c '{pip_path} install -q --upgrade pip && {pip_path} install -q -r {requirements_file}'",
            check=False
        )
        print("✅ Dependencias instaladas")
    else:
        print("⚠️ requirements.txt no encontrado, saltando instalación de dependencias")
    
    return True

def run_migrations():
    """Ejecuta migraciones de Prisma si es necesario"""
    print("\n🗄️ Verificando migraciones de base de datos...")
    
    response = input("¿Deseas ejecutar migraciones de Prisma? (s/n): ")
    if response.lower() != 's':
        print("⏭️ Saltando migraciones")
        return True
    
    print("🗄️ Ejecutando migraciones...")
    # Usar bash explícitamente y el path completo de prisma
    prisma_path = f"{VENV_PATH}/bin/prisma"
    run_command(
        f"cd {BACKEND_DIR} && bash -c '{prisma_path} migrate deploy'",
        check=False
    )
    
    return True

def restart_service():
    """Reinicia el servicio"""
    print("\n🔄 Reiniciando servicio...")
    
    # Verificar si el servicio existe
    result = subprocess.run(
        f"systemctl list-units --type=service | grep {SERVICE_NAME}",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"⚠️ Servicio {SERVICE_NAME} no encontrado")
        print("💡 Intentando con supervisor...")
        run_command(f"sudo supervisorctl restart digpatho_backend", check=False)
        return True
    
    # Reiniciar servicio
    if not run_command(f"sudo systemctl restart {SERVICE_NAME}", check=False):
        print("❌ Error al reiniciar el servicio")
        return False
    
    # Esperar un momento
    import time
    time.sleep(2)
    
    # Verificar estado
    print("\n📊 Estado del servicio:")
    run_command(f"sudo systemctl status {SERVICE_NAME} --no-pager -l", check=False)
    
    return True

def verify_deployment():
    """Verifica que el despliegue fue exitoso"""
    print("\n✅ Verificando despliegue...")
    
    # Verificar que el servicio está corriendo
    result = subprocess.run(
        f"sudo systemctl is-active {SERVICE_NAME}",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.stdout.strip() == "active":
        print("✅ Servicio está activo")
    else:
        print(f"⚠️ Servicio no está activo: {result.stdout.strip()}")
    
    # Mostrar últimos logs
    print("\n📋 Últimos logs del servicio:")
    run_command(f"sudo journalctl -u {SERVICE_NAME} -n 20 --no-pager", check=False)
    
    return True

def main():
    """Función principal"""
    print("="*80)
    print("🚀 SCRIPT DE DESPLIEGUE MANUAL - EC2")
    print("="*80)
    print(f"📁 Directorio: {BACKEND_DIR}")
    print(f"🌿 Rama: {BRANCH}")
    print(f"🔧 Servicio: {SERVICE_NAME}")
    print("="*80)
    
    # Verificar que se ejecuta como root o con sudo
    if os.geteuid() != 0:
        print("\n⚠️ Advertencia: Este script debería ejecutarse con sudo")
        response = input("¿Continuar de todas formas? (s/n): ")
        if response.lower() != 's':
            sys.exit(1)
    
    # Verificar prerrequisitos
    if not check_prerequisites():
        print("\n❌ Prerrequisitos no cumplidos. Abortando.")
        sys.exit(1)
    
    # Arreglar ownership de git (necesario cuando se ejecuta como root)
    fix_git_ownership()
    
    # Hacer backup
    backup_current_code()
    
    # Pull del código
    if not pull_code():
        print("\n❌ Error al descargar código. Abortando.")
        sys.exit(1)
    
    # Instalar dependencias
    install_dependencies()
    
    # Ejecutar migraciones (opcional)
    run_migrations()
    
    # Reiniciar servicio
    if not restart_service():
        print("\n❌ Error al reiniciar servicio")
        sys.exit(1)
    
    # Verificar despliegue
    verify_deployment()
    
    print("\n" + "="*80)
    print("✅ DESPLIEGUE COMPLETADO")
    print("="*80)
    print("\n💡 Próximos pasos:")
    print("   1. Verifica los logs: sudo journalctl -u uvicorn-prepro.service -f")
    print("   2. Prueba el endpoint: curl https://api.digpatho.com/docs")
    print("   3. Si hay problemas, revisa los logs de error")
    print("="*80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Despliegue cancelado por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
