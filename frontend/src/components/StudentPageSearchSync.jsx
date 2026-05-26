import { useEffect } from "react";
import { useStudentHeaderSearch } from "../contexts/StudentHeaderSearchContext";

/** Bridges header search into page state. Render inside StudentDashboardSectionPage children. */
export default function StudentPageSearchSync({ onSearchChange }) {
  const { search } = useStudentHeaderSearch();

  useEffect(() => {
    onSearchChange(search);
  }, [search, onSearchChange]);

  return null;
}
