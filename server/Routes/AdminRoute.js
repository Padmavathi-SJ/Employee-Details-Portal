import express from "express";
import connection from "../DB/db.js";
import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_KEY;


// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'profile_img' ? 'uploads/profile_images/' : 'uploads/resumes/';
    cb(null, folder); // Different folders for profile images and resumes
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName); // Ensure unique filenames
  },
});

const upload = multer({ storage });


router.post("/adminLogin", (req, res) => {
  const sql = "SELECT * FROM admin WHERE email = ?";
  connection.query(sql, [req.body.email], async (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    
    if (result.length > 0) {
      // Retrieve stored hash from the database
      const storedPasswordHash = result[0].password;
      
      // Compare the provided password with the stored hash using bcrypt
      const isMatch = await bcrypt.compare(req.body.password, storedPasswordHash);

      if (isMatch) {
        const email = result[0].email;
        const token = jwt.sign(
          { role: "admin", email: email },
          JWT_SECRET, // Use JWT_SECRET from environment variable
          { expiresIn: "1d" }
        );
        res.cookie("token", token);
        return res.json({ loginStatus: true });
      } else {
        return res.json({ loginStatus: false, Error: "Wrong email or password" });
      }
    } else {
      return res.json({ loginStatus: false, Error: "Wrong email or password" });
    }
  });
});


// Fetch all admin details
router.get('/admins', (req, res) => {
  const sql = 'SELECT * FROM admin';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching admins:', err);
      return res.status(500).json({ Status: false, Error: 'Database Query Error' });
    }
    return res.json({ Status: true, Admins: results });
  });
});


router.post('/add_admin', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ Status: false, Error: 'Missing required fields' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Password Hashing Error:', err);
      return res.status(500).json({ Status: false, Error: 'Password Hashing Error' });
    }

    const sql = 'INSERT INTO admin (email, password) VALUES (?, ?)';
    const values = [email, hash];

    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error inserting new admin:', err);
        return res.status(500).json({ Status: false, Error: 'Database Query Error' });
      }
      return res.json({ Status: true, Result: result });
    });
  });
});


router.get("/get_departments", (req, res) => {
  const sql = "SELECT * FROM department";
  connection.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

// Route to get employees by department_id
router.get('/get_employees_by_department/:departmentId', (req, res) => {
  const { departmentId } = req.params;

  const sql = `SELECT * FROM employees WHERE department_id = ?`;

//  console.log('Received departmentId:', departmentId);

  connection.query(sql, [departmentId], (err, result) => {
    if (err) {
      console.error('Database Query Error:', err);
      return res.status(500).json({ Status: false, Error: 'Database Query Error' });
    }

   // console.log('SQL Query:', sql);
    // console.log('Query Result:', result);

    if (result.length > 0) {
      res.json({ Status: true, Result: result });
    } else {
      res.json({ Status: false, Message: 'No employees found for this department' });
    }
  });
});


// Route to get employee details by employee_id
router.get('/get_employee_details/:employeeId', (req, res) => {
  const { employeeId } = req.params;

  const sql = `SELECT id, name, email, role, experience, department_id, salary, degree, university, graduation_year, skills, certifications, mobile_no, address, resume, profile_img FROM employees WHERE id = ?`;

  connection.query(sql, [employeeId], (err, result) => {
    if (err) {
      console.error('Database Query Error:', err);
      return res.status(500).json({ Status: false, Error: 'Database Query Error' });
    }

    if (result.length > 0) {
      const employeeDetails = result[0];

      // Check if the employee has a resume (file) and return the URL or file path
      if (employeeDetails.resume) {
        employeeDetails.resume = `/uploads/resumes/${employeeDetails.resume}`; // Assuming resumes are stored in 'uploads/resumes' folder
      } else {
        employeeDetails.resume = null; // No resume uploaded
      }

      res.json({ Status: true, Result: employeeDetails });
    } else {
      res.json({ Status: false, Error: 'Employee not found' });
    }
  });
});


router.post("/add_department", (req, res) => {
  const checkSql = "SELECT * FROM department WHERE name = ?";
  connection.query(checkSql, [req.body.department], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });

    if (result.length > 0) {
      // Department already exists
      return res.json({ Status: false, Error: "Department already exists" });
    }

    const insertSql = "INSERT INTO department (name) VALUES (?)";
    connection.query(insertSql, [req.body.department], (err, result) => {
      if (err) return res.json({ Status: false, Error: "Query Error" });
      return res.json({ Status: true });
    });
  });
});

router.delete("/delete_department/:departmentId", (req, res) => {
  const { departmentId } = req.params;

  // Find employees in the department
  const findEmployeesSql = "SELECT id FROM employees WHERE department_id = ?";
  connection.query(findEmployeesSql, [departmentId], (err, employees) => {
    if (err) {
      console.error("Error finding employees:", err);
      return res.json({ Status: false, Error: "Error finding employees" });
    }

    const employeeIds = employees.map((emp) => emp.id);

    if (employeeIds.length > 0) {
      // Delete feedback for employees in the department
      const deleteFeedbackSql = "DELETE FROM feedback WHERE employee_id IN (?)";
      connection.query(deleteFeedbackSql, [employeeIds], (err) => {
        if (err) {
          console.error("Error deleting feedback:", err);
          return res.json({ Status: false, Error: "Error deleting feedback" });
        }

        // Delete work_allocation for employees in the department
        const deleteWorkAllocationSql = "DELETE FROM work_allocation WHERE employee_id IN (?)";
        connection.query(deleteWorkAllocationSql, [employeeIds], (err) => {
          if (err) {
            console.error("Error deleting work allocation:", err);
            return res.json({ Status: false, Error: "Error deleting work allocation" });
          }

          // Delete leave_requests for employees in the department
          const deleteLeaveRequestsSql = "DELETE FROM leave_requests WHERE employee_id IN (?)";
          connection.query(deleteLeaveRequestsSql, [employeeIds], (err) => {
            if (err) {
              console.error("Error deleting leave requests:", err);
              return res.json({ Status: false, Error: "Error deleting leave requests" });
            }

            // Delete employees in the department
            const deleteEmployeesSql = "DELETE FROM employees WHERE department_id = ?";
            connection.query(deleteEmployeesSql, [departmentId], (err) => {
              if (err) {
                console.error("Error deleting employees:", err);
                return res.json({ Status: false, Error: "Error deleting employees" });
              }

              // Finally, delete the department
              const deleteDepartmentSql = "DELETE FROM department WHERE id = ?";
              connection.query(deleteDepartmentSql, [departmentId], (err, result) => {
                if (err) {
                  console.error("Error deleting department:", err);
                  return res.json({ Status: false, Error: "Error deleting department" });
                }

                if (result.affectedRows === 0) {
                  return res.json({ Status: false, Message: "Department not found" });
                }

                return res.json({
                  Status: true,
                  Message: "Department and all related data deleted successfully",
                });
              });
            });
          });
        });
      });
    } else {
      // No employees, directly delete the department
      const deleteDepartmentSql = "DELETE FROM department WHERE id = ?";
      connection.query(deleteDepartmentSql, [departmentId], (err, result) => {
        if (err) {
          console.error("Error deleting department:", err);
          return res.json({ Status: false, Error: "Error deleting department" });
        }

        if (result.affectedRows === 0) {
          return res.json({ Status: false, Message: "Department not found" });
        }

        return res.json({
          Status: true,
          Message: "Department deleted successfully",
        });
      });
    }
  });
});



router.post('/add_employee', upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'profile_img', maxCount: 1 }
]), (req, res) => {
  const {
    name,
    email,
    password,
    role,
    experience,
    department_id,
    salary,
    degree,
    university,
    graduation_year,
    skills,
    certifications,
    mobile_no,
    address,
  } = req.body;

  if (!name || !email || !password || !role || !department_id || !salary || !degree || !university || !graduation_year || !mobile_no || !address) {
    return res.status(400).json({ Status: false, Error: 'Missing required fields' });
  }

  const resume = req.files?.resume?.[0]?.path || null;
  const profileImg = req.files?.profile_img?.[0]?.path || null;

  const sql = `INSERT INTO employees (name, email, password, role, experience, department_id, salary, degree, university, graduation_year, skills, certifications, mobile_no, address, resume, profile_img) 
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Password Hashing Error:', err);
      return res.status(500).json({ Status: false, Error: 'Password Hashing Error' });
    }

    const values = [
      name,
      email,
      hash,
      role,
      experience || 0,
      department_id,
      salary,
      degree,
      university,
      graduation_year,
      skills || '',
      certifications || '',
      mobile_no,
      address,
      resume,
      profileImg,
    ];

    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error('Database Query Error:', err);
        return res.status(500).json({ Status: false, Error: 'Database Query Error' });
      }
      return res.json({ Status: true, Result: result });
    });
  });
});




router.get("/get_employees", (req, res) => {
  const sql = `
    SELECT 
      employees.id AS employeeId, 
      employees.name, 
      department.name AS department, 
      employees.role 
    FROM employees 
    LEFT JOIN department ON employees.department_id = department.id;
  `;
  connection.query(sql, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    return res.json({ Status: true, Result: result });
  });
});


router.delete("/delete_employee/:employeeId", (req, res) => {
  const { employeeId } = req.params;

  // Delete feedback related to the employee
  const deleteFeedbackSql = "DELETE FROM feedback WHERE employee_id = ?";
  connection.query(deleteFeedbackSql, [employeeId], (err) => {
    if (err) {
      console.error("Error deleting feedback:", err);
      return res.json({ Status: false, Error: "Error deleting feedback" });
    }

    // Delete work_allocation related to the employee
    const deleteWorkAllocationSql = "DELETE FROM work_allocation WHERE employee_id = ?";
    connection.query(deleteWorkAllocationSql, [employeeId], (err) => {
      if (err) {
        console.error("Error deleting work allocation:", err);
        return res.json({ Status: false, Error: "Error deleting work allocation" });
      }

      // Delete leave_requests related to the employee
      const deleteLeaveRequestsSql = "DELETE FROM leave_requests WHERE employee_id = ?";
      connection.query(deleteLeaveRequestsSql, [employeeId], (err) => {
        if (err) {
          console.error("Error deleting leave requests:", err);
          return res.json({ Status: false, Error: "Error deleting leave requests" });
        }

        // Finally, delete the employee
        const deleteEmployeeSql = "DELETE FROM employees WHERE id = ?";
        connection.query(deleteEmployeeSql, [employeeId], (err, result) => {
          if (err) {
            console.error("Error deleting employee:", err);
            return res.json({ Status: false, Error: "Error deleting employee" });
          }

          if (result.affectedRows === 0) {
            return res.json({ Status: false, Message: "Employee not found" });
          }

          return res.json({ Status: true, Message: "Employee and all related data deleted successfully" });
        });
      });
    });
  });
});



router.put("/edit_employee/:employeeId", (req, res) => {
  const { employeeId } = req.params;
  const {
    name,
    email,
    password,
    role,
    experience,
    department_id,
    salary,
    degree,
    university,
    graduation_year,
    skills,
    certifications,
    mobile_no,
    address,
  } = req.body;

  if (!name || !email || !password || !role || !department_id || !salary) {
    return res.status(400).json({ Status: false, Error: "Missing required fields" });
  }

  const passwordUpdate = password ? bcrypt.hashSync(password, 10) : undefined;

  const sql = `UPDATE employees SET 
    name = ?, 
    email = ?, 
    password = ?, 
    role = ?, 
    experience = ?, 
    department_id = ?, 
    salary = ?, 
    degree = ?, 
    university = ?, 
    graduation_year = ?, 
    skills = ?, 
    certifications = ?, 
    mobile_no = ?, 
    address = ? 
    WHERE id = ?`;

  const values = [
    name,
    email,
    passwordUpdate || null,
    role,
    experience,
    department_id,
    salary,
    degree,
    university,
    graduation_year,
    skills,
    certifications,
    mobile_no,
    address,
    employeeId,
  ];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Database Query Error:", err);
      return res.status(500).json({ Status: false, Error: "Database Query Error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, Error: "Employee not found" });
    }

    return res.json({ Status: true, Result: result });
  });
});




router.get("/get_employee_by_id/:employeeId", (req, res) => {
  const { employeeId } = req.params;

  const sql = "SELECT * FROM employees WHERE id = ?";
  connection.query(sql, [employeeId], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    if (result.length === 0) {
      return res.json({ Status: false, Error: "Employee not found" });
    }
    return res.json({ Status: true, Result: result });
  });
});


router.post("/allocate_work", (req, res) => {
  const { employee_id, title, description, deadline, priority } = req.body;

  if (!employee_id || !title || !deadline) {
    return res.status(400).json({ Status: false, Error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO work_allocation (employee_id, title, description, deadline, priority)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(sql, [employee_id, title, description, deadline, priority], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ Status: false, Error: "Query Error" });
    }

    // Optionally, add notification logic here
    res.json({ Status: true, Result: result });
  });
});

router.get("/get_tasks", (req, res) => {
  const sql = `
    SELECT 
      work_allocation.id AS taskId, 
      work_allocation.title, 
      work_allocation.description, 
      work_allocation.deadline, 
      work_allocation.priority, 
      work_allocation.status,  -- Include the status field
      employees.name AS employee_name 
    FROM work_allocation 
    JOIN employees ON work_allocation.employee_id = employees.id
  `;
  connection.query(sql, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    return res.json({ Status: true, Result: result });
  });
});


router.get("/get_task/:taskId", (req, res) => {
  const { taskId } = req.params;
  const sql = "SELECT * FROM work_allocation WHERE id = ?";
  connection.query(sql, [taskId], (err, result) => {
    if (err) {
      console.error("Error fetching task:", err);
      return res.status(500).json({ Status: false, Error: "Error fetching task" });
    }

    if (result.length === 0) {
      return res.status(404).json({ Status: false, Error: "Task not found" });
    }

    return res.json(result[0]);  // Return the task details as JSON
  });
});


router.put("/edit_task/:taskId", (req, res) => {
  const { taskId } = req.params;
  const { title, description, deadline, priority } = req.body;

  if (!title || !description || !deadline || !priority) {
    return res.status(400).json({ Status: false, Error: "Missing required fields" });
  }

  const sql = `
    UPDATE work_allocation
    SET title = ?, description = ?, deadline = ?, priority = ?
    WHERE id = ?
  `;
  
  const values = [title, description, deadline, priority, taskId];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ Status: false, Error: "Query Error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, Error: "Task not found" });
    }

    return res.json({ Status: true, Message: "Task updated successfully" });
  });
});


router.delete("/delete_task/:taskId", (req, res) => {
  const { taskId } = req.params;

  const sql = "DELETE FROM work_allocation WHERE id = ?";

  connection.query(sql, [taskId], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }

    if (result.affectedRows > 0) {
      return res.json({ Status: true, Message: "Task deleted successfully" });
    } else {
      return res.json({ Status: false, Error: "Task not found" });
    }
  });
});

// Get all leave requests for admin

router.get("/leave_requests", (req, res) => {
  const sql = "SELECT * FROM leave_requests";

  connection.query(sql, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Error fetching leave requests" });
    }

    return res.json({ Status: true, Result: result });
  });
});

// Approve or Reject a leave request
router.put("/leave_requests/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;  // 'approved' or 'rejected'

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ Status: false, Error: "Invalid status" });
  }

  // Update the leave request status in the database
  const updateStatusSql = "UPDATE leave_requests SET status = ? WHERE id = ?";
  connection.query(updateStatusSql, [status, id], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Error updating leave request status" });
    }

    if (result.affectedRows > 0) {
      return res.json({ Status: true, Message: "Leave request status updated successfully" });
    } else {
      return res.json({ Status: false, Error: "Leave request not found" });
    }
  });
});


router.get("/dashboard_metrics", async (req, res) => {
  try {
    // Queries for the metrics
    const queries = {
      totalEmployees: "SELECT COUNT(*) AS total FROM employees",
      pendingLeaves: "SELECT COUNT(*) AS total FROM leave_requests WHERE status = 'Pending'",
      totalDepartments: "SELECT COUNT(*) AS total FROM department",
      totalTasks: "SELECT COUNT(*) AS total FROM work_allocation",
    };

    // Execute all queries in parallel
    const [employeeResult, leaveResult, departmentResult, taskResult] = await Promise.all([
      new Promise((resolve, reject) =>
        connection.query(queries.totalEmployees, (err, result) =>
          err ? reject(err) : resolve(result)
        )
      ),
      new Promise((resolve, reject) =>
        connection.query(queries.pendingLeaves, (err, result) =>
          err ? reject(err) : resolve(result)
        )
      ),
      new Promise((resolve, reject) =>
        connection.query(queries.totalDepartments, (err, result) =>
          err ? reject(err) : resolve(result)
        )
      ),
      new Promise((resolve, reject) =>
        connection.query(queries.totalTasks, (err, result) =>
          err ? reject(err) : resolve(result)
        )
      ),
    ]);

    // Build the response object
    const metrics = {
      totalEmployees: employeeResult[0].total,
      pendingLeaveRequests: leaveResult[0].total,
      totalDepartments: departmentResult[0].total,
      totalTasks: taskResult[0].total,
    };

    // Send the response
    res.json({ Status: true, Metrics: metrics });
  } catch (err) {
    console.error("Error fetching dashboard metrics:", err);
    res.status(500).json({ Status: false, Error: "Error fetching dashboard metrics" });
  }
});

// Fetch all feedback
router.get("/feedback", (req, res) => {
  const sql = "SELECT * FROM feedback";

  connection.query(sql, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Error fetching feedback" });
    }

    return res.json({ Status: true, Result: result });
  });
});

// Approve or Reject feedback
// Update feedback status (approved or rejected)
router.put("/feedback/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ Status: false, Error: "Invalid status" });
  }

  const updateStatusSql = "UPDATE feedback SET status = ? WHERE id = ?";
  connection.query(updateStatusSql, [status, id], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Error updating feedback status" });
    }

    if (result.affectedRows > 0) {
      return res.json({ Status: true, Message: "Feedback status updated successfully" });
    } else {
      return res.json({ Status: false, Error: "Feedback not found" });
    }
  });
});

// Update feedback solution
router.put("/feedback/:id/solution", (req, res) => {
  const { id } = req.params;
  const { solution } = req.body;

  if (!solution) {
    return res.status(400).json({ Status: false, Error: "Solution cannot be empty" });
  }

  const updateSolutionSql = "UPDATE feedback SET solution = ? WHERE id = ?";
  connection.query(updateSolutionSql, [solution, id], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.json({ Status: false, Error: "Error updating feedback solution" });
    }

    if (result.affectedRows > 0) {
      return res.json({ Status: true, Message: "Solution updated successfully" });
    } else {
      return res.json({ Status: false, Error: "Feedback not found" });
    }
  });
});

router.post('/create_team', (req, res) => {
  const { team_name, team_members, department_id } = req.body;

  // Validate inputs
  if (!team_name || !Array.isArray(team_members) || team_members.length === 0) {
    return res.status(400).json({ Status: false, Message: "Invalid input. Please provide a valid team name and select members." });
  }

  // Prepare the SQL query to insert the team into the database
  const query = "INSERT INTO teams (team_name, team_members, department_id, created_at) VALUES (?, ?, ?, NOW())";

  // Convert the team_members array to JSON format before inserting into the database
  const teamMembersJson = JSON.stringify(team_members);

  connection.query(query, [team_name, teamMembersJson, department_id], (err, results) => {
    if (err) {
      console.error("Error creating team:", err);
      return res.status(500).json({ Status: false, Error: "Error creating team." });
    }

    // Return a success response if the team is created
    res.json({ Status: true, Message: "Team created successfully", TeamId: results.insertId });
  });
});


router.get('/get_teams', (req, res) => {
  const query = "SELECT * FROM teams";

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching teams:", err);
      return res.status(500).json({ Status: false, Error: "Error fetching teams." });
    }

    // Parse team_members JSON to make it easier to work with in the frontend
    const teams = results.map(team => ({
      ...team,
      team_members: JSON.parse(team.team_members) // Parse the JSON field to get employee IDs
    }));

    res.json({ Status: true, Result: teams });
  });
});


router.get("/get_team/:team_id", (req, res) => {
  const { team_id } = req.params;
  const sql = "SELECT * FROM teams WHERE team_id = ?";
  
  connection.query(sql, [team_id], (err, result) => {
    if (err) {
      console.error("Error fetching team:", err);
      return res.status(500).json({ Status: false, Error: "Error fetching team" });
    }

    if (result.length === 0) {
      return res.status(404).json({ Status: false, Error: "Team not found" });
    }

    return res.json({ Status: true, Result: result[0] }); // Return the team details as JSON
  });
});


// Update team details
router.put("/edit_team/:team_id", (req, res) => {
  const { team_id } = req.params;
  const { team_name, team_members } = req.body;

  // Check for required fields in the request body
  if (!team_name || !team_members) {
    return res.status(400).json({ Status: false, Error: "Missing required fields" });
  }

  const sql = `
    UPDATE teams
    SET team_name = ?, team_members = ?
    WHERE team_id = ?
  `;
  
  const values = [team_name, JSON.stringify(team_members), team_id]; // team_members will be stored as a JSON string
  
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ Status: false, Error: "Query Error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, Error: "Team not found" });
    }

    return res.json({ Status: true, Message: "Team updated successfully" });
  });
});

router.delete("/delete_team/:team_id", (req, res) => {
  const { team_id } = req.params;

  if (!team_id) {
    return res.status(400).json({ Status: false, Error: "Team ID is required" });
  }

  const sql = `
    DELETE FROM teams
    WHERE team_id = ?
  `;

  connection.query(sql, [team_id], (err, result) => {
    if (err) {
      console.error("Query Error:", err);
      return res.status(500).json({ Status: false, Error: "Database query error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ Status: false, Error: "Team not found" });
    }

    return res.json({ Status: true, Message: "Team deleted successfully" });
  });
});






export { router as adminRouter };
