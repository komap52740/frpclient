from django.core.exceptions import ValidationError

from apps.appointments.models import validate_payment_proof
from upload_helpers import make_test_heic_upload


def test_payment_proof_validator_allows_heic_up_to_100mb():
    file_obj = make_test_heic_upload("receipt.heic")
    file_obj.size = 100 * 1024 * 1024
    validate_payment_proof(file_obj)


def test_payment_proof_validator_rejects_file_larger_than_100mb():
    file_obj = make_test_heic_upload("receipt.heic")
    file_obj.size = 100 * 1024 * 1024 + 1
    try:
        validate_payment_proof(file_obj)
        raised = False
    except ValidationError:
        raised = True
    assert raised is True
