import pytest

from app.services.availability import clean_description, _parse_time
from datetime import datetime


class TestCleanDescription:
    def test_removes_teams_boilerplate(self):
        desc = (
            "\n________________________________________________________________________________\n"
            "Reunión de Microsoft Teams\n"
            "Unirse: https://teams.microsoft.com/join\n"
            "Meeting ID: 123\n"
            "Passcode: abc\n"
            "For organizers: Opciones de la reunión<https://teams...>\n"
            "Privacidad y seguridad<http://www.mav-sa.com.ar/>\n"
            "[Company Logo]\n"
            "Contenido real de la reunión\n"
        )
        cleaned = clean_description(desc)
        assert "Reunión de Microsoft Teams" not in cleaned
        assert "Passcode" not in cleaned
        assert "Meeting ID" not in cleaned
        assert "For organizers" not in cleaned
        assert "Privacidad" not in cleaned
        assert "Company Logo" not in cleaned
        assert "Contenido real de la reunión" in cleaned

    def test_empty(self):
        assert clean_description("") == ""
        assert clean_description(None) == ""

    def test_keeps_real_content(self):
        desc = "Vamos a repasar el sprint\n- punto 1\n- punto 2"
        cleaned = clean_description(desc)
        assert "punto 1" in cleaned


class TestParseTime:
    def test_basic(self):
        d = datetime(2026, 9, 22)
        assert _parse_time("09:00", d) == datetime(2026, 9, 22, 9, 0)
        assert _parse_time("18:30", d) == datetime(2026, 9, 22, 18, 30)