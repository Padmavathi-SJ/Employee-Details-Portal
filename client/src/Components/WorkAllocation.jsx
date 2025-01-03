import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTasks, FaTrash, FaEdit, FaUsers } from "react-icons/fa"; // Added FaUsers for team work icon
import axios from "axios";

const WorkAllocation = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]); // State to hold fetched tasks

  // Function to fetch tasks from the API
  const fetchTasks = () => {
    axios.get("http://localhost:3000/auth/get_tasks")
      .then((response) => {
        if (response.data.Status) {
          setTasks(response.data.Result); // Set tasks state if response is successful
        } else {
          console.error("Error fetching tasks:", response.data.Error);
        }
      })
      .catch((error) => {
        console.error("API Error:", error);
      });
  };

  useEffect(() => {
    // Fetch tasks initially
    fetchTasks();

    // Set up polling to fetch tasks every 5 seconds (you can adjust the interval)
    const intervalId = setInterval(fetchTasks, 5000);

    // Clean up the interval when the component is unmounted
    return () => clearInterval(intervalId);
  }, []);

  const handleNavigation = () => {
    navigate("/admin-dashboard/allocate_work");
  };

  const handleTeamNavigation = () => {
    navigate("/admin-dashboard/team_work_allocation");
  };

  const handleDelete = (taskId) => {
    axios.delete(`http://localhost:3000/auth/delete_task/${taskId}`)
      .then((response) => {
        if (response.data.Status) {
          setTasks(tasks.filter((task) => task.taskId !== taskId));
        } else {
          console.error("Error deleting task:", response.data.Error);
        }
      })
      .catch((error) => {
        console.error("API Error:", error);
      });
  };

  const handleEdit = (taskId) => {
    navigate(`/admin-dashboard/edit_work/${taskId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      {/* Individual Work Allocation Container */}
      <div
        className="p-6 bg-white shadow-lg rounded-lg cursor-pointer hover:shadow-xl transition-shadow duration-300 flex items-center space-x-4"
        onClick={handleNavigation}
      >
        <div className="p-4 bg-indigo-100 rounded-full">
          <FaTasks className="text-indigo-600 text-3xl" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Allocate Work</h2>
          <p className="text-gray-500">Click here to allocate tasks to employees.</p>
        </div>
      </div>

      {/* Team Work Allocation Container */}
      <div
        className="p-6 bg-white shadow-lg rounded-lg cursor-pointer hover:shadow-xl transition-shadow duration-300 flex items-center space-x-4 mt-6"
        onClick={handleTeamNavigation}
      >
        <div className="p-4 bg-green-100 rounded-full">
          <FaUsers className="text-green-600 text-3xl" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Allocate Work for a Team</h2>
          <p className="text-gray-500">Click here to allocate tasks for a team.</p>
        </div>
      </div>

      <div className="mt-8 w-full max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Assigned Tasks</h2>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.taskId} className="flex items-center justify-between bg-white p-4 shadow-md rounded-lg">
              <div>
                <h3 className="text-lg font-medium text-gray-800">{task.title}</h3>
                <p className="text-sm text-gray-500">{task.description}</p>
                <p className="text-sm text-gray-500">Deadline: {task.deadline}</p>
                <p className="text-sm text-gray-500">Priority: {task.priority}</p>
                <p className="text-sm text-gray-500">Assigned to: {task.employee_name}</p>
                <p className="text-sm text-gray-500">Status: {task.status}</p>
              </div>
              <div className="flex space-x-4">
                {/* Edit button */}
                <button
                  className="text-blue-600 hover:text-blue-800"
                  onClick={() => handleEdit(task.taskId)}
                >
                  <FaEdit className="text-xl" />
                </button>

                {/* Delete button */}
                <button
                  className="text-red-600 hover:text-red-800"
                  onClick={() => handleDelete(task.taskId)}
                >
                  <FaTrash className="text-xl" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkAllocation;
