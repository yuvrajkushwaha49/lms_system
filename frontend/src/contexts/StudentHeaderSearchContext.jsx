import { createContext, useContext } from "react";

export const StudentHeaderSearchContext = createContext({
  search: "",
  setSearch: () => {},
});

export function useStudentHeaderSearch() {
  return useContext(StudentHeaderSearchContext);
}
