import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Star, ThumbsUp, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const RatingStars = ({ value, onChange, label }) => {
  return (
    <div>
      <label className="text-sm text-gray-700 font-medium mb-2 block">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-all"
          >
            <Star
              className={`w-8 h-8 ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default function ClientFeedbackForm({ projects, companyId, userEmail }) {
  const [selectedProject, setSelectedProject] = React.useState('');
  const [ratings, setRatings] = React.useState({
    overall_rating: 0,
    quality_rating: 0,
    communication_rating: 0,
    timeliness_rating: 0,
    budget_rating: 0
  });
  const [comments, setComments] = React.useState('');
  const [wouldRecommend, setWouldRecommend] = React.useState(false);
  const [testimonialApproved, setTestimonialApproved] = React.useState(false);
  const [areasOfExcellence, setAreasOfExcellence] = React.useState([]);
  const [areasForImprovement, setAreasForImprovement] = React.useState([]);

  const queryClient = useQueryClient();

  const { data: existingFeedback = [] } = useQuery({
    queryKey: ['clientFeedback', companyId],
    queryFn: () => base44.entities.ClientFeedback.filter({ client_id: companyId }),
    enabled: !!companyId,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: (feedbackData) => base44.entities.ClientFeedback.create(feedbackData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientFeedback'] });
      // Reset form
      setSelectedProject('');
      setRatings({
        overall_rating: 0,
        quality_rating: 0,
        communication_rating: 0,
        timeliness_rating: 0,
        budget_rating: 0
      });
      setComments('');
      setWouldRecommend(false);
      setTestimonialApproved(false);
      setAreasOfExcellence([]);
      setAreasForImprovement([]);
      toast.success('Thank you for your feedback!');
    },
  });

  const handleSubmit = () => {
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    if (ratings.overall_rating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }

    submitFeedbackMutation.mutate({
      project_id: selectedProject,
      client_id: companyId,
      submitted_by: userEmail,
      ...ratings,
      comments,
      would_recommend: wouldRecommend,
      testimonial_approved: testimonialApproved,
      areas_of_excellence: areasOfExcellence,
      areas_for_improvement: areasForImprovement,
      status: 'Submitted'
    });
  };

  const excellenceOptions = [
    'Quality of work',
    'Communication',
    'Timeliness',
    'Budget management',
    'Problem-solving',
    'Professionalism',
    'Responsiveness',
    'Attention to detail'
  ];

  const improvementOptions = [
    'Communication frequency',
    'Response time',
    'Project timeline',
    'Budget transparency',
    'Quality control',
    'Documentation',
    'Cleanup',
    'Follow-up'
  ];

  const projectsWithoutFeedback = projects.filter(p => 
    !existingFeedback.some(f => f.project_id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Submitted Feedback */}
      {existingFeedback.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Your Submitted Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {existingFeedback.map((feedback) => {
                const project = projects.find(p => p.id === feedback.project_id);
                
                return (
                  <div key={feedback.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{project?.name}</h3>
                        <p className="text-sm text-gray-600">
                          Submitted {new Date(feedback.created_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold text-gray-900">
                          {feedback.overall_rating}/5
                        </span>
                      </div>
                    </div>
                    {feedback.comments && (
                      <p className="text-sm text-gray-700 mt-2">{feedback.comments}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Form */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Share Your Project Experience</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Your feedback helps us improve and deliver better service
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {projectsWithoutFeedback.length === 0 ? (
            <div className="p-8 text-center">
              <ThumbsUp className="w-12 h-12 mx-auto text-green-600 mb-3" />
              <p className="text-gray-600">
                Thank you! You've provided feedback for all completed projects.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Select Completed Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    {projectsWithoutFeedback.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && (
                <>
                  {/* Ratings */}
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900">Rate Your Experience</h3>
                    
                    <RatingStars
                      label="Overall Satisfaction"
                      value={ratings.overall_rating}
                      onChange={(val) => setRatings({...ratings, overall_rating: val})}
                    />
                    
                    <RatingStars
                      label="Quality of Work"
                      value={ratings.quality_rating}
                      onChange={(val) => setRatings({...ratings, quality_rating: val})}
                    />
                    
                    <RatingStars
                      label="Communication"
                      value={ratings.communication_rating}
                      onChange={(val) => setRatings({...ratings, communication_rating: val})}
                    />
                    
                    <RatingStars
                      label="Timeliness"
                      value={ratings.timeliness_rating}
                      onChange={(val) => setRatings({...ratings, timeliness_rating: val})}
                    />
                    
                    <RatingStars
                      label="Budget Management"
                      value={ratings.budget_rating}
                      onChange={(val) => setRatings({...ratings, budget_rating: val})}
                    />
                  </div>

                  {/* Areas of Excellence */}
                  <div className="pt-4 border-t border-gray-200">
                    <Label className="mb-3 block">What did we do well?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {excellenceOptions.map(option => (
                        <div key={option} className="flex items-center gap-2">
                          <Checkbox
                            checked={areasOfExcellence.includes(option)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAreasOfExcellence([...areasOfExcellence, option]);
                              } else {
                                setAreasOfExcellence(areasOfExcellence.filter(a => a !== option));
                              }
                            }}
                          />
                          <label className="text-sm text-gray-700">{option}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Areas for Improvement */}
                  <div className="pt-4 border-t border-gray-200">
                    <Label className="mb-3 block">What can we improve?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {improvementOptions.map(option => (
                        <div key={option} className="flex items-center gap-2">
                          <Checkbox
                            checked={areasForImprovement.includes(option)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAreasForImprovement([...areasForImprovement, option]);
                              } else {
                                setAreasForImprovement(areasForImprovement.filter(a => a !== option));
                              }
                            }}
                          />
                          <label className="text-sm text-gray-700">{option}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div className="pt-4 border-t border-gray-200">
                    <Label>Additional Comments</Label>
                    <Textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Tell us more about your experience..."
                      className="bg-white border-gray-300 mt-2"
                      rows={4}
                    />
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={wouldRecommend}
                        onCheckedChange={setWouldRecommend}
                      />
                      <label className="text-sm text-gray-700">
                        I would recommend DALCORE to others
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={testimonialApproved}
                        onCheckedChange={setTestimonialApproved}
                      />
                      <label className="text-sm text-gray-700">
                        You may use my feedback as a testimonial
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitFeedbackMutation.isPending}
                    className="w-full bg-[#0E351F] hover:bg-[#3B5B48] text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}