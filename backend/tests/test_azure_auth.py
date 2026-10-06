import pytest
from azure.identity import ClientSecretCredential, DefaultAzureCredential

from app import azure_auth
from app.config import settings

SERVICE_PRINCIPAL = {
    "azure_tenant_id": "11111111-1111-1111-1111-111111111111",
    "azure_client_id": "22222222-2222-2222-2222-222222222222",
    "azure_client_secret": "test-secret",
}


def use(monkeypatch, **values):
    for name in SERVICE_PRINCIPAL:
        monkeypatch.setattr(settings, name, values.get(name, ""))


def test_a_service_principal_in_settings_is_used(monkeypatch):
    use(monkeypatch, **SERVICE_PRINCIPAL)

    credential = azure_auth.azure_credential()

    assert isinstance(credential, ClientSecretCredential)
    assert credential._tenant_id == SERVICE_PRINCIPAL["azure_tenant_id"]


@pytest.mark.parametrize("missing", list(SERVICE_PRINCIPAL))
def test_an_incomplete_service_principal_falls_back_to_the_default_chain(monkeypatch, missing):
    use(monkeypatch, **{name: value for name, value in SERVICE_PRINCIPAL.items() if name != missing})

    assert isinstance(azure_auth.azure_credential(), DefaultAzureCredential)
