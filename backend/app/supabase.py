import threading

from supabase import Client, create_client

from .config import settings

_per_thread = threading.local()


def create_admin_client() -> Client:
    """A new service-role client, for one request.

    Use it for anything that stores a session on the client: sign_in_with_password,
    sign_out, set_session. After a sign-in, supabase-py sends that user's token
    (not the service key) on the client's database and Storage requests.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def shared_admin_client() -> Client:
    """A service-role client reused across requests, one per thread.

    Building a client costs ~0.2 s of CPU per HTTP client (auth, database, Storage),
    so reusing it keeps bursts of requests from queueing. It is per thread, not
    per process: the database client speaks HTTP/2, and one HTTP/2 connection
    used from several threads at once fails with read errors.

    Stateless use only: service-role table queries, Storage calls, and
    auth.get_user(token) with the token passed in. Never sign in, sign out,
    set_session or postgrest.auth() on it: that would store one user's session
    and send it on later users' requests. Use create_admin_client() instead.
    """
    client = getattr(_per_thread, "client", None)
    if client is None:
        client = create_admin_client()
        _per_thread.client = client
    return client
