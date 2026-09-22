from app.services.holidays import get_ar_holidays, holiday_on, is_holiday


class TestHolidays:
    def test_fetches_current_year(self):
        hols = get_ar_holidays(2026)
        assert isinstance(hols, dict)
        assert len(hols) > 5
        # 25 de mayo is always a national holiday
        assert "2026-05-25" in hols

    def test_holiday_on(self):
        assert holiday_on("2026-05-25") == "Día de la Revolución de Mayo"
        assert holiday_on("2026-09-22") is None

    def test_is_holiday(self):
        from datetime import datetime

        assert is_holiday(datetime(2026, 5, 25, 10, 0)) is True
        assert is_holiday(datetime(2026, 9, 22, 10, 0)) is False