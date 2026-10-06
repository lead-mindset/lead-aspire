from azure.core.credentials import TokenCredential
from azure.identity import ClientSecretCredential, DefaultAzureCredential

from .config import settings


def azure_credential() -> TokenCredential:
    """The service principal from settings when all three values are set.

    Otherwise DefaultAzureCredential: real AZURE_* environment variables, managed
    identity, or the local `az login` session. pydantic only reads .env into
    settings, not into os.environ, so DefaultAzureCredential alone would ignore a
    service principal configured in .env and silently use `az login` instead.
    """
    if settings.azure_tenant_id and settings.azure_client_id and settings.azure_client_secret:
        return ClientSecretCredential(
            tenant_id=settings.azure_tenant_id,
            client_id=settings.azure_client_id,
            client_secret=settings.azure_client_secret,
        )
    return DefaultAzureCredential()
