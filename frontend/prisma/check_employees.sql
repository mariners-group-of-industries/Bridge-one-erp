SELECT e.id, e."employeeCode", e.name, o.name as office FROM employees e JOIN offices o ON o.id = e."officeId" ORDER BY e."employeeCode" LIMIT 20;
