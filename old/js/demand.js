define(['jsPDF', 'moment', 'chart1'] , function (jsPDF, moment) {

    $(function () {
        $('[data-toggle="tooltipDemand"]').tooltip();

        function getRandColor(brightness) {
            //6 levels of brightness from 0 to 5, 0 being the darkest
            var rgb = [Math.random() * 128, Math.random() * 256, Math.random() * 256];
            var mix = [brightness * 51, brightness * 51, brightness * 51]; //51 => 255/5
            var mixedrgb = [(Math.random() * 128) + rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function (x) {
                return Math.round(x / 2.0);
            });

            return mixedrgb.join(",");
        }

        function randColors() {
            var mixedrgb = getRandColor(0);
            return ["rgb(" + mixedrgb + ")", "rgba(" + mixedrgb + ",0.2)", "rgba(" + mixedrgb + ", 1)"];
        }

        var canvas = document.getElementById("demand-QbyS");
        var ctx = canvas.getContext("2d");
        var faresChart;
        
        var $loader = $('#demand-loading');
        var $preloader = $('#demand-placeholder');
        var $legend = $('#demand-graph-legend');
        var $dowloadLinks = $('#demand-download-links');
        
        var datasets;
        var chartData;
        var chartConfig = {
            barShowStroke: false,
            tooltipTitleFontFamily: "'Titillium Web',sans-serif",
            tooltipFontStyle: "600",
            tooltipFontFamily: "'Titillium Web',sans-serif",
            tooltipTitleFontStyle: "600",
            scaleFontFamily: "'Titillium Web',sans-serif",
            scaleFontStyle: "700",
            responsive: true,
            maintainAspectRatio: true,
            tooltipFillColor: "rgba(0,0,0,0.8)",
            multiTooltipTemplate: "<%= datasetLabel %> - <%= value %>"
        };
    
        window.globalDataDemand = {labels:[], data:[], fLabels:[]};
        
        var formatDate = function (date) {
            var month = date.getMonth() + 1;
            if (month < 10) {
                month = '0' + month;
            }

            var day = date.getDate();
            if (day < 10) {
                day = '0' + day;
            }

            return date.getFullYear() + '-' + month + "-" + day;
        };

        $('body').on('click', '#demand .build-report', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var sd = $('#demand-range-start-date').val();
            var ed = $('#demand-range-end-date').val();
            var od = $('#demand-dep-date').val();
            var dt = $('#demand-type').val();

            if (typeof sd === 'undefined') {
                alert('Start date is required!');
                return false;
            }

            if (typeof ed === 'undefined') {
                alert('End date is required!');
                return false;
            }

            if (typeof od === 'undefined') {
                alert('Dep date is required!');
                return false;
            }

            var from = $('#demand-origin').val();
            if (typeof from === 'undefined' || $.trim(from).length === 0) {
                alert('Origin is required!');
                return false;
            }

            var to = $('#demand-destination').val();
            if (typeof to === 'undefined' || $.trim(to).length === 0) {
                alert('Destination is required!');
                return false;
            }

            var startDate = new Date(Date.parse(sd));
            var endDate = new Date(Date.parse(ed));
            var depDate = new Date(Date.parse(od));

            var endpoint = '//api1.webjet.com/metashopper/rs/airdata/search-demand/' + from + '/' + to;
            endpoint += '/' + formatDate(depDate) + '/period/' + formatDate(startDate) + '/' + formatDate(endDate);
            if(dt){
                endpoint += '?type=' + dt;
            }

            $preloader.show(0);
            $loader.show(0);
            $legend.hide(0);
            $dowloadLinks.hide(0);

            var token = JSON.parse(localStorage.getItem('auth')) || {};
            if(token['token']){
                token = token['token']
            } else {
                token = ''
            }
            jQuery.ajax({
                url: endpoint,
                method: 'GET',
                dataType: 'json',
                headers: {
                    'X-MSOTA-SESSION': token,
                    'Content-Type': 'application/json'
                },
                success: function (d) {

                    $preloader.hide(0);
                    $loader.hide(0);
                    $legend.show();
                    $dowloadLinks.show();

                    gData = d;
                    showCharts(d.data, d.labels);
                },
                error: function (error) {
                    if(error.status == 401){
                        localStorage.removeItem('auth');
                        location.pathname = '/login'
                    }
                    console.warn(error);
                }
            });
        });

        function showCharts(dData, dLabels){
            var d = {};
            d.data = dData;
            d.labels = dLabels;

            var labels = d.labels;

            //set this data gloabaly for get csv
            window.globalDataDemand.labels = labels;
            window.globalDataDemand.data = d.data;

            if(!Object.keys(d.data).length){
                console.log('empty data');
                return false;
            }

            datasets = [];

            window.globalDataDemand.fLabels = labels;
            var colors = randColors();

            datasets.push({
                data: d.data,
                fillColor: colors[1],
                strokeColor: colors[0],
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: colors[2],
                pointColor: colors[2]
            });

            chartData = {
                labels: labels,
                datasets: datasets
            };

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (faresChart) {
                faresChart.destroy();
            }

            faresChart = new Chart(ctx).Line(chartData, chartConfig);

            $('#demand-graph-legend').html(faresChart.generateLegend());

        }
        
        var $body = $('body');
        var doc = new jsPDF('p','mm','a4');

        var $outbound = $body.find('#demand-dep-date');
        var today = moment();
        $outbound.val(today.format('YYYY-MM-DD'));
        $('#demandDepDate').daterangepicker({
            autoApply: true,
            singleDatePicker: true,
            startDate: today.format('L')
        }, function(start, end, label) {
            $outbound.val(start.format('YYYY-MM-DD'));
        });

        var $startRange = $body.find('#demand-range-start-date');
        var $endRange = $body.find('#demand-range-end-date');
        var startDate = moment().startOf('month');
        var endDate = moment().endOf('month');
        $startRange.val(startDate.format('YYYY-MM-DD'));
        $endRange.val(endDate.format('YYYY-MM-DD'));
        $('#demandRange').daterangepicker({
            autoApply: true,
            startDate: startDate.format('L'),
            endDate: endDate.format('L')
        }, function(start, end, label) {
            $startRange.val(start.format('YYYY-MM-DD'));
            $endRange.val(end.format('YYYY-MM-DD'));
        });

        $body.on('click', '#demand-download-pdf', function () {
            var $content = $('.demand-exported-content');//.clone();
            $content.css({padding: '30px'});
            var $downloadLinks = $content.find('#demand-download-links');
            $downloadLinks.hide(0);

            var $tables = $('#demand').find('table');
            $tables.each(function(i, item){
                if($(this).width() > $(this).parents('.panel').width()){
                    $(this).parents('.table-responsive').addClass('reformat');
                }
            });

            doc.addHTML($content.get(0), function() {
                doc.save(generateName() +  '.pdf');
                $content.css({padding: '0'});
                $downloadLinks.show(0);
                $('#demand').find('.reformat').removeClass('reformat');
            });
        });

        $body.on('click', '#demand-download-csv', function () {

            function getValues(data, source){
                var values = [];
                source.forEach(function(key) {
                    if(data.hasOwnProperty(key)){
                        values.push(data[key]);
                    } else {
                        values.push(null);
                    }
                });
                return values;
            }

            var labels = globalDataDemand.labels;
            var csvContent = "data:text/csv;charset=utf-8,";
            csvContent += labels.join(",") + "\n";

            var item = getValues(globalDataDemand.data, labels);
            var dataString = item.join(",");
            csvContent += dataString;

            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", generateName() + ".csv");

            link.click();
        });

        function generateName(){
            return 'airdatadb-demand-' + $('#demand-origin').val() + '-' + $('#demand-destination').val() + '-'
                    + getDate($('#demand-range-start-date').val()) + '-' + getDate($('#demand-range-end-date').val())
        }

        function getDate(date){
            date = new Date(date);
            var day = '' + date.getDate();
            var monthIndex = '' + (date.getMonth() + 1);
            var year = date.getFullYear();

            return (monthIndex.length < 2 ? '0' + monthIndex : monthIndex) + '-'
                + (day.length < 2 ? '0' + day : day) + '-' + year;
        }

    });

});